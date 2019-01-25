// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as cp from 'child_process';
import * as copypaste from 'copy-paste';
import * as fs from 'fs-plus';
import {Guid} from 'guid-typescript';
import {MoleHole} from 'molehole';
import * as path from 'path';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, FileNames} from '../constants';
import {DialogResponses} from '../DialogResponses';
import {DockerBuildConfig, DockerManager} from '../DockerManager';
import {TerminalManager} from '../TerminalManager';
import {runCommand} from '../utils';

import {ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';
import {SSH, SSH_UPLOAD_METHOD} from './SSH';

class YoctoUploadConfig {
  static host = 'yocto';
  static port = 22;
  static user = 'root';
  static password = '';
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

    if (!YoctoUploadConfig.updated) {
      const res = await this.configSSH();
      if (!res) {
        vscode.window.showWarningMessage('Configure SSH cancelled.');
        return true;
      }
    }

    const methodChoice = await vscode.window.showQuickPick(
        [
          {label: 'SFTP', detail: 'Upload via SFTP'},
          {label: 'SCP', detail: 'Upload via SCP'}
        ],
        {
          ignoreFocusOut: true,
          matchOnDescription: true,
          matchOnDetail: true,
          placeHolder: 'Select upload method',
        });

    if (!methodChoice) {
      return false;
    }

    const sshUploadMethod = methodChoice.label === 'SFTP' ?
        SSH_UPLOAD_METHOD.SFTP :
        SSH_UPLOAD_METHOD.SCP;

    const ssh = new SSH(this.channel);

    const sshConnected = await ssh.connect(
        YoctoUploadConfig.host, YoctoUploadConfig.port, YoctoUploadConfig.user,
        YoctoUploadConfig.password);
    let sshUploaded: boolean;
    if (sshConnected) {
      if (sshUploadMethod === SSH_UPLOAD_METHOD.SCP) {
        ssh.shell(`mkdir -p ${YoctoUploadConfig.projectPath}`);
      }
      sshUploaded = await ssh.upload(
          buildTargetPath, YoctoUploadConfig.projectPath as string,
          sshUploadMethod);
    } else {
      await ssh.close();
      this.channel.appendLine('SSH connection failed.');
      vscode.window.showInformationMessage('SSH connection failed.');
      return false;
    }

    if (!sshUploaded) {
      await ssh.close();
      this.channel.appendLine(`${methodChoice.label} upload failed.`);
      vscode.window.showInformationMessage(
          `Yocto project upload failed via ${methodChoice.label}.`);
      return false;
    }

    // make uploaded build executable
    await ssh.shell(`cd ${YoctoUploadConfig.projectPath} && chmod -R 755 .\/`);

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
        label: 'Config Yocto Device SSH',
        description: 'Config Yocto Device SSH',
        detail: 'Config SSH'
      },
      {
        label: 'Copy device connection string',
        description: 'Copy device connection string',
        detail: 'Copy'
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
      const deviceConnectionString =
          ConfigHandler.get<string>(ConfigKey.iotHubDeviceConnectionString);

      if (!deviceConnectionString) {
        throw new Error(
            'Unable to get the device connection string, please invoke the command of Azure Provision first.');
      }
      copypaste.copy(deviceConnectionString);
      return true;
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
    // Yocto Device host
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
        value: YoctoUploadConfig.host,
        prompt: `Please input Yocto device ip or hostname here.`,
        ignoreFocusOut: true
      };
      raspiHost = await vscode.window.showInputBox(raspiHostOption);
      if (raspiHost === undefined) {
        return false;
      }
    }
    raspiHost = raspiHost || YoctoUploadConfig.host;

    // Yocto Device SSH port
    const raspiPortOption: vscode.InputBoxOptions = {
      value: YoctoUploadConfig.port.toString(),
      prompt: `Please input Yocto device SSH port here.`,
      ignoreFocusOut: true
    };
    const raspiPortString = await vscode.window.showInputBox(raspiPortOption);
    if (raspiPortString === undefined) {
      return false;
    }
    const raspiPort = raspiPortString && !isNaN(Number(raspiPortString)) ?
        Number(raspiPortString) :
        YoctoUploadConfig.port;

    // Yocto device user name
    const raspiUserOption: vscode.InputBoxOptions = {
      value: YoctoUploadConfig.user,
      prompt: `Please input Yocto device user name here.`,
      ignoreFocusOut: true
    };
    let raspiUser = await vscode.window.showInputBox(raspiUserOption);
    if (raspiUser === undefined) {
      return false;
    }
    raspiUser = raspiUser || YoctoUploadConfig.user;

    // Yocto device user password
    const raspiPasswordOption: vscode.InputBoxOptions = {
      value: YoctoUploadConfig.password,
      prompt: `Please input Yocto device password here.`,
      ignoreFocusOut: true
    };
    const raspiPassword = await vscode.window.showInputBox(raspiPasswordOption);
    if (raspiPassword === undefined) {
      return false;
    }
    // raspiPassword = raspiPassword || RaspberryPiUploadConfig.password;

    // Yocto device path
    const raspiPathOption: vscode.InputBoxOptions = {
      value: YoctoUploadConfig.projectPath,
      prompt: `Please input Yocto device path here.`,
      ignoreFocusOut: true
    };
    let raspiPath = await vscode.window.showInputBox(raspiPathOption);
    if (raspiPath === undefined) {
      return false;
    }
    raspiPath = raspiPath || YoctoUploadConfig.projectPath;

    YoctoUploadConfig.host = raspiHost;
    YoctoUploadConfig.port = raspiPort;
    YoctoUploadConfig.user = raspiUser;
    YoctoUploadConfig.password = raspiPassword;
    YoctoUploadConfig.projectPath = raspiPath;
    YoctoUploadConfig.updated = true;
    return true;
  }
}