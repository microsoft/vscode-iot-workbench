// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {devicePath} from 'azure-iot-common/lib/endpoint';
import * as cp from 'child_process';
import * as fs from 'fs-plus';
import {Guid} from 'guid-typescript';
import {MoleHole} from 'molehole';
import * as path from 'path';
import {utils} from 'ssh2';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, FileNames} from '../constants';
import {DialogResponses} from '../DialogResponses';
import {DockerBuildConfig, DockerManager} from '../DockerManager';
import {TerminalManager} from '../TerminalManager';
import {runCommand} from '../utils';

import {ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';
import {SSH} from './SSH';

const constants = {
  defaultSketchFileName: 'app.js'
};

class RaspberryPiUploadConfig {
  static host = 'raspberrypi';
  static port = 22;
  static user = 'pi';
  static password = 'raspberry';
  static projectPath = 'IoTProject';
  static updated = false;
}

export class YoctoDevice implements Device {
  private componentId: string;
  get id() {
    return this.componentId;
  }
  private deviceType: DeviceType;
  private componentType: ComponentType;
  private deviceFolder: string;
  private extensionContext: vscode.ExtensionContext;
  private channel: vscode.OutputChannel;
  private sketchFolder = '';
  private static _boardId = 'yocto';

  static get boardId() {
    return YoctoDevice._boardId;
  }

  constructor(
      context: vscode.ExtensionContext, devicePath: string,
      channel: vscode.OutputChannel, sketchFolder?: string) {
    this.deviceType = DeviceType.Raspberry_Pi;
    this.componentType = ComponentType.Device;
    this.deviceFolder = devicePath;
    this.extensionContext = context;
    this.channel = channel;
    this.componentId = Guid.create().toString();
    if (sketchFolder) {
      this.sketchFolder = sketchFolder;
    }
  }

  name = 'YoctoDevice';

  getDeviceType(): DeviceType {
    return this.deviceType;
  }

  getComponentType(): ComponentType {
    return this.componentType;
  }

  async checkPrerequisites(): Promise<boolean> {
    return true;
  }

  async load(): Promise<boolean> {
    const deviceFolderPath = this.deviceFolder;

    if (!fs.existsSync(deviceFolderPath)) {
      throw new Error('Unable to find the device folder inside the project.');
    }

    if (!fs.existsSync(path.join(deviceFolderPath, 'node_modules'))) {
      cp.exec('npm install', {cwd: deviceFolderPath});
    }
    return true;
  }

  async create(): Promise<boolean> {
    const deviceFolderPath = this.deviceFolder;

    if (!fs.existsSync(deviceFolderPath)) {
      throw new Error('Unable to find the device folder inside the project.');
    }

    try {
      const iotworkbenchprojectFilePath =
          path.join(deviceFolderPath, FileNames.iotworkbenchprojectFileName);
      fs.writeFileSync(iotworkbenchprojectFilePath, ' ');
    } catch (error) {
      throw new Error(
          `Device: create iotworkbenchproject file failed: ${error.message}`);
    }

    const vscodeFolderPath =
        path.join(deviceFolderPath, FileNames.vscodeSettingsFolderName);
    if (!fs.existsSync(vscodeFolderPath)) {
      fs.mkdirSync(vscodeFolderPath);
    }

    const sketchFolderPath = this.extensionContext.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, YoctoDevice.boardId, this.sketchFolder));

    // Copy all file under resource folder into target project.
    fs.copySync(sketchFolderPath, deviceFolderPath);
    return true;
  }

  async compile(): Promise<boolean> {
    const dockerManager = new DockerManager();

    // check whether docker is installed
    this.channel.show();
    this.channel.appendLine('Check whether Docker is installed...');
    try {
      await runCommand(
          dockerManager.constructGetVersionCmd(), '', this.channel);
      this.channel.appendLine('Docker is installed.');
    } catch {
      // Docker is not installed.
      const option = await vscode.window.showInformationMessage(
          'Docker is required to compile the code. Do you want to install Docker now?',
          DialogResponses.yes, DialogResponses.cancel);
      if (option === DialogResponses.yes) {
        vscode.commands.executeCommand(
            'vscode.open', vscode.Uri.parse('https://www.docker.com/'));
      }
      return false;
    }

    // Generate commands for build application from docker.
    // read config file
    const configFilePath =
        path.join(this.deviceFolder, FileNames.dockerBuildConfigFileName);
    if (!fs.existsSync(configFilePath)) {
      // TODO: Replace this with copy default.
      throw new Error(
          'Build config file does not exist. Please check the project settings.');
    }

    const buildConfig: DockerBuildConfig =
        JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
    if (!buildConfig) {
      // create the output folder
      throw new Error(
          'Build config file is not valid. Please check the project settings.');
    }

    // Create output folder
    const targetFolderPath = path.join(this.deviceFolder, buildConfig.output);
    if (!fs.existsSync(targetFolderPath)) {
      fs.mkdirSync(targetFolderPath);
    }

    const dockerCommand = dockerManager.constructCommandForBuildConfig(
        buildConfig, this.deviceFolder);
    this.channel.appendLine(dockerCommand);

    TerminalManager.runInTerminal(dockerCommand);
    return true;
  }

  async upload(): Promise<boolean> {
    if (!fs.existsSync(path.join(this.deviceFolder, 'build.json'))) {
      await vscode.window.showWarningMessage('No build config file found.');
      return false;
    }

    const buildConfigRaw =
        fs.readFileSync(path.join(this.deviceFolder, 'build.json'), 'utf8');
    const buildConfig = JSON.parse(buildConfigRaw) as {
      source: string,
      output: string,
    };
    const buildTargetPath = path.join(
        this.deviceFolder, buildConfig.output, 'cmake', buildConfig.source);
    if (!fs.existsSync(buildTargetPath)) {
      await vscode.window.showErrorMessage(
          `Cannot find build target file under ${buildTargetPath}`);
      return false;
    }

    if (!RaspberryPiUploadConfig.updated) {
      const res = await this.configSSH();
      if (!res) {
        vscode.window.showWarningMessage('Configure SSH cancelled.');
        return true;
      }
    }

    const ssh = new SSH(this.channel);

    const sshConnected = await ssh.connect(
        RaspberryPiUploadConfig.host, RaspberryPiUploadConfig.port,
        RaspberryPiUploadConfig.user, RaspberryPiUploadConfig.password);
    let sshUploaded: boolean;
    if (sshConnected) {
      sshUploaded = await ssh.upload(
          buildTargetPath, RaspberryPiUploadConfig.projectPath as string);
    } else {
      await ssh.close();
      this.channel.appendLine('SSH connection failed.');
      vscode.window.showInformationMessage('SSH connection failed.');
      return false;
    }

    if (!sshUploaded) {
      await ssh.close();
      this.channel.appendLine('SFTP upload failed.');
      vscode.window.showInformationMessage(
          'Yocto project upload failed via SFTP.');
      return false;
    }

    // make uploaded build executable
    await ssh.shell(
        `cd ${RaspberryPiUploadConfig.projectPath} && chmod -R 755 .\/`);

    await ssh.close();
    if (this.channel) {
      this.channel.appendLine('Yocto project uploaded.');
    }

    vscode.window.showInformationMessage('Yocto project uploaded.');
    return true;
  }

  async configDeviceSettings(): Promise<boolean> {
    const configSelectionItems: vscode.QuickPickItem[] = [
      {
        label: 'Config Raspberry Pi SSH',
        description: 'Config Raspberry Pi SSH',
        detail: 'Config SSH'
      },
      {
        label: 'Config connection of IoT Hub Device',
        description: 'Config connection of IoT Hub Device',
        detail: 'Config IoT Hub Device'
      }
    ];

    const configSelection =
        await vscode.window.showQuickPick(configSelectionItems, {
          ignoreFocusOut: true,
          matchOnDescription: true,
          matchOnDetail: true,
          placeHolder: 'Select an option',
        });

    if (!configSelection) {
      return false;
    }

    if (configSelection.detail === 'Config SSH') {
      try {
        const res = await this.configSSH();
        if (res) {
          vscode.window.showInformationMessage('Config SSH successfully.');
        }
        return res;
      } catch (error) {
        vscode.window.showWarningMessage('Config SSH failed.');
        return false;
      }
    } else {
      try {
        const res = await this.configHub();
        return res;
      } catch (error) {
        vscode.window.showWarningMessage('Config IoT Hub failed.');
        return false;
      }
    }
  }

  async getSSHEnabledDevicePickItems() {
    const deviceList: vscode.QuickPickItem[] = [];
    const devices = await MoleHole.getDevicesFromLAN();
    const raspberryPiDevices =
        devices.filter(info => info.id === 'raspberrypi');
    for (const device of raspberryPiDevices) {
      if (device.ip) {
        deviceList.push({label: device.ip, detail: device.host || '<Unknown>'});
      }
    }

    deviceList.push(
        {
          label: '$(sync) Discover again',
          detail: 'Auto discover SSH enabled device in LAN'
        },
        {
          label: '$(gear) Manual setup',
          detail: 'Setup device SSH configuration manually'
        });

    return deviceList;
  }

  async configSSH(): Promise<boolean> {
    // Raspberry Pi host
    const sshDiscoverOrInputItems: vscode.QuickPickItem[] = [
      {
        label: '$(search) Auto discover',
        detail: 'Auto discover SSH enabled device in LAN'
      },
      {
        label: '$(gear) Manual setup',
        detail: 'Setup device SSH configuration manually'
      }
    ];
    const sshDiscoverOrInputChoice =
        await vscode.window.showQuickPick(sshDiscoverOrInputItems, {
          ignoreFocusOut: true,
          matchOnDescription: true,
          matchOnDetail: true,
          placeHolder: 'Select an option',
        });
    if (!sshDiscoverOrInputChoice) {
      return false;
    }

    let raspiHost: string|undefined;

    if (sshDiscoverOrInputChoice.label === '$(search) Auto discover') {
      let selectDeviceChoice: vscode.QuickPickItem|undefined;
      do {
        const selectDeviceItems = this.getSSHEnabledDevicePickItems();
        selectDeviceChoice =
            await vscode.window.showQuickPick(selectDeviceItems, {
              ignoreFocusOut: true,
              matchOnDescription: true,
              matchOnDetail: true,
              placeHolder: 'Select a device',
            });
      } while (selectDeviceChoice &&
               selectDeviceChoice.label === '$(sync) Discover again');

      if (!selectDeviceChoice) {
        return false;
      }

      if (selectDeviceChoice.label !== '$(gear) Manual setup') {
        raspiHost = selectDeviceChoice.label;
      }
    }

    if (!raspiHost) {
      const raspiHostOption: vscode.InputBoxOptions = {
        value: RaspberryPiUploadConfig.host,
        prompt: `Please input Raspberry Pi ip or hostname here.`,
        ignoreFocusOut: true
      };
      raspiHost = await vscode.window.showInputBox(raspiHostOption);
      if (raspiHost === undefined) {
        return false;
      }
    }
    raspiHost = raspiHost || RaspberryPiUploadConfig.host;

    // Raspberry Pi SSH port
    const raspiPortOption: vscode.InputBoxOptions = {
      value: RaspberryPiUploadConfig.port.toString(),
      prompt: `Please input Raspberry Pi SSH port here.`,
      ignoreFocusOut: true
    };
    const raspiPortString = await vscode.window.showInputBox(raspiPortOption);
    if (raspiPortString === undefined) {
      return false;
    }
    const raspiPort = raspiPortString && !isNaN(Number(raspiPortString)) ?
        Number(raspiPortString) :
        RaspberryPiUploadConfig.port;

    // Raspberry Pi user name
    const raspiUserOption: vscode.InputBoxOptions = {
      value: RaspberryPiUploadConfig.user,
      prompt: `Please input Raspberry Pi user name here.`,
      ignoreFocusOut: true
    };
    let raspiUser = await vscode.window.showInputBox(raspiUserOption);
    if (raspiUser === undefined) {
      return false;
    }
    raspiUser = raspiUser || RaspberryPiUploadConfig.user;

    // Raspberry Pi user password
    const raspiPasswordOption: vscode.InputBoxOptions = {
      value: RaspberryPiUploadConfig.password,
      prompt: `Please input Raspberry Pi password here.`,
      ignoreFocusOut: true
    };
    let raspiPassword = await vscode.window.showInputBox(raspiPasswordOption);
    if (raspiPassword === undefined) {
      return false;
    }
    // raspiPassword = raspiPassword || RaspberryPiUploadConfig.password;

    // Raspberry Pi path
    const raspiPathOption: vscode.InputBoxOptions = {
      value: RaspberryPiUploadConfig.projectPath,
      prompt: `Please input Raspberry Pi path here.`,
      ignoreFocusOut: true
    };
    let raspiPath = await vscode.window.showInputBox(raspiPathOption);
    if (raspiPath === undefined) {
      return false;
    }
    raspiPath = raspiPath || RaspberryPiUploadConfig.projectPath;

    RaspberryPiUploadConfig.host = raspiHost;
    RaspberryPiUploadConfig.port = raspiPort;
    RaspberryPiUploadConfig.user = raspiUser;
    RaspberryPiUploadConfig.password = raspiPassword;
    RaspberryPiUploadConfig.projectPath = raspiPath;
    RaspberryPiUploadConfig.updated = true;
    return true;
  }

  async configHub(): Promise<boolean> {
    try {
      const deviceFolderPath = this.deviceFolder;

      if (!fs.existsSync(deviceFolderPath)) {
        throw new Error('Unable to find the device folder inside the project.');
      }

      // Get IoT Hub device connection string from config
      let deviceConnectionString =
          ConfigHandler.get<string>(ConfigKey.iotHubDeviceConnectionString);

      let hostName = '';
      let deviceId = '';
      if (deviceConnectionString) {
        const hostnameMatches =
            deviceConnectionString.match(/HostName=(.*?)(;|$)/);
        if (hostnameMatches) {
          hostName = hostnameMatches[0];
        }

        const deviceIDMatches =
            deviceConnectionString.match(/DeviceId=(.*?)(;|$)/);
        if (deviceIDMatches) {
          deviceId = deviceIDMatches[0];
        }
      }

      let deviceConnectionStringSelection: vscode.QuickPickItem[] = [];
      if (deviceId && hostName) {
        deviceConnectionStringSelection = [
          {
            label: 'Select IoT Hub Device Connection String',
            description: '',
            detail: `Device Information: ${hostName} ${deviceId}`
          },
          {
            label: 'Input IoT Hub Device Connection String',
            description: '',
            detail: 'Input another...'
          }
        ];
      } else {
        deviceConnectionStringSelection = [{
          label: 'Input IoT Hub Device Connection String',
          description: '',
          detail: 'Input another...'
        }];
      }

      const selection =
          await vscode.window.showQuickPick(deviceConnectionStringSelection, {
            ignoreFocusOut: true,
            placeHolder: 'Choose IoT Hub Device Connection String'
          });

      if (!selection) {
        return false;
      }

      if (selection.detail === 'Input another...') {
        const option: vscode.InputBoxOptions = {
          value:
              'HostName=<Host Name>;DeviceId=<Device Name>;SharedAccessKey=<Device Key>',
          prompt: `Please input device connection string here.`,
          ignoreFocusOut: true
        };

        deviceConnectionString = await vscode.window.showInputBox(option);
        if (!deviceConnectionString) {
          return false;
        }
        if ((deviceConnectionString.indexOf('HostName') === -1) ||
            (deviceConnectionString.indexOf('DeviceId') === -1) ||
            (deviceConnectionString.indexOf('SharedAccessKey') === -1)) {
          throw new Error(
              'The format of the IoT Hub Device connection string is invalid. Please provide a valid Device connection string.');
        }
      }

      if (!deviceConnectionString) {
        return false;
      }

      console.log(deviceConnectionString);

      // Set selected connection string to device
      try {
        const configFilePath = path.join(deviceFolderPath, 'config.json');
        const config = {connectionString: deviceConnectionString};
        fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
      } catch (error) {
        throw new Error(`Device: create config file failed: ${error.message}`);
      }

      vscode.window.showInformationMessage(
          'Configure Device connection string successfully.');
      return true;
    } catch (error) {
      throw error;
    }
  }
}