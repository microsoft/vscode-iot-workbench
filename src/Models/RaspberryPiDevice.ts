// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import {Guid} from 'guid-typescript';
import * as path from 'path';
import * as vscode from 'vscode';
import * as sdk from 'vscode-iot-device-cube-sdk';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, FileNames, OperationType, ScaffoldType} from '../constants';
import {FileUtility} from '../FileUtility';
import * as utils from '../utils';
import {runCommand} from '../utils';

import {ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';
import {ProjectTemplateType, TemplateFileInfo} from './Interfaces/ProjectTemplate';
import {IoTWorkbenchProjectBase} from './IoTWorkbenchProjectBase';
import {RemoteExtension} from './RemoteExtension';

class RaspberryPiUploadConfig {
  static host = 'raspberrypi';
  static port = 22;
  static user = 'pi';
  static password = 'raspberry';
  static projectPath = 'IoTProject';
  static updated = false;
}

export class RaspberryPiDevice implements Device {
  private componentId: string;
  get id() {
    return this.componentId;
  }
  private deviceType: DeviceType;
  private componentType: ComponentType;
  private projectFolder: string;
  private channel: vscode.OutputChannel;
  private static _boardId = 'raspberrypi';
  private extensionContext: vscode.ExtensionContext;

  private outputPath: string;

  static get boardId() {
    return RaspberryPiDevice._boardId;
  }

  constructor(
      context: vscode.ExtensionContext, projectPath: string,
      channel: vscode.OutputChannel, projectTemplateType: ProjectTemplateType,
      private templateFilesInfo: TemplateFileInfo[] = []) {
    this.deviceType = DeviceType.Raspberry_Pi;
    this.componentType = ComponentType.Device;
    this.channel = channel;
    this.componentId = Guid.create().toString();
    this.extensionContext = context;
    this.projectFolder = projectPath;
    this.outputPath = path.join(this.projectFolder, FileNames.outputPathName);
  }

  name = 'RaspberryPi';

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
    // ScaffoldType is Workspace when loading a project
    const scaffoldType = ScaffoldType.Workspace;
    if (!await FileUtility.directoryExists(scaffoldType, this.projectFolder)) {
      throw new Error('Unable to find the project folder.');
    }

    await IoTWorkbenchProjectBase.generateIotWorkbenchProjectFile(
        scaffoldType, this.projectFolder);

    return true;
  }

  async create(): Promise<boolean> {
    // ScaffoldType is local when creating a project
    const scaffoldType = ScaffoldType.Local;
    if (!await FileUtility.directoryExists(scaffoldType, this.projectFolder)) {
      throw new Error('Unable to find the project folder.');
    }

    await IoTWorkbenchProjectBase.generateIotWorkbenchProjectFile(
        scaffoldType, this.projectFolder);
    await this.generateSketchFile(scaffoldType, this.templateFilesInfo);

    return true;
  }

  async generateSketchFile(
      type: ScaffoldType,
      templateFilesInfo: TemplateFileInfo[]): Promise<boolean> {
    if (!templateFilesInfo) {
      throw new Error('No sketch file found.');
    }

    // Cannot use forEach here since it's async
    for (const fileInfo of templateFilesInfo) {
      const targetFolderPath =
          path.join(this.projectFolder, fileInfo.targetPath);
      if (!await FileUtility.directoryExists(type, targetFolderPath)) {
        await FileUtility.mkdirRecursively(type, targetFolderPath);
      }

      const targetFilePath = path.join(targetFolderPath, fileInfo.fileName);
      if (fileInfo.fileContent) {
        try {
          await FileUtility.writeFile(
              type, targetFilePath, fileInfo.fileContent);
        } catch (error) {
          throw new Error(`Failed to create sketch file ${
              fileInfo.fileName} for Raspberry Pi: ${error.message}`);
        }
      }
    }

    return true;
  }

  async compile(): Promise<boolean> {
    const isRemote = RemoteExtension.isRemote(this.extensionContext);
    if (!isRemote) {
      const res =
          await utils.askAndOpenInRemote(OperationType.Compile, this.channel);
      if (!res) {
        return false;
      }
    }

    if (!fs.existsSync(this.outputPath)) {
      try {
        fs.mkdirSync(this.outputPath);
      } catch (error) {
        throw new Error(`Failed to create output path ${
            this.outputPath}. Error message: ${error.message}`);
      }
    }

    this.channel.show();
    this.channel.appendLine('Compiling Raspberry Pi device code...');
    const compileBashFile = '/work/compile_app.sh';
    try {
      await runCommand(
          `bash ${compileBashFile} ${this.projectFolder}/src`, '',
          this.channel);
    } catch (error) {
      throw new Error(
          `Failed to compile Raspberry Pi device code. Error message: ${
              error.message}`);
    }

    // If successfully compiled, copy compiled files to user workspace
    const binFilePath = '/work/azure-iot-sdk-c/cmake/iot_application';
    if (fs.existsSync(binFilePath)) {
      const getOutputFileCmd = `cp -rf ${binFilePath} ${this.outputPath}`;
      try {
        await runCommand(getOutputFileCmd, '', this.channel);
      } catch (error) {
        throw new Error(`Failed to copy compiled files to output folder ${
            this.outputPath}. Error message: ${error.message}`);
      }
    } else {
      this.channel.show();
      this.channel.appendLine(
          'Bin files not found. Compilation may have failed.');
      return false;
    }

    const message = 'Successfully compile Raspberry Pi device code.';
    this.channel.show();
    this.channel.appendLine(message);
    vscode.window.showInformationMessage(message);

    return true;
  }

  async upload(): Promise<boolean> {
    const isRemote = RemoteExtension.isRemote(this.extensionContext);
    if (!isRemote) {
      const res =
          await utils.askAndOpenInRemote(OperationType.Upload, this.channel);
      if (!res) {
        return false;
      }
    }

    try {
      const binFilePath =
          path.join(this.outputPath, 'iot_application/azure_exe');
      if (!fs.existsSync(binFilePath)) {
        const message =
            `Binary file does not exist. Please compile device code first.`;
        await vscode.window.showWarningMessage(message);
        return false;
      }

      if (!RaspberryPiUploadConfig.updated) {
        const res = await this.configSSH();
        if (!res) {
          vscode.window.showWarningMessage('Configure SSH cancelled.');
          return true;
        }
      }

      const ssh = new sdk.SSH();
      await ssh.open(
          RaspberryPiUploadConfig.host, RaspberryPiUploadConfig.port,
          RaspberryPiUploadConfig.user, RaspberryPiUploadConfig.password);
      try {
        await ssh.uploadFile(binFilePath, RaspberryPiUploadConfig.projectPath);
        const enableExecPriorityCommand =
            `cd ${RaspberryPiUploadConfig.projectPath} && chmod -R 755 .\/`;
        const result = await ssh.exec(enableExecPriorityCommand);

        const message = `result: ${result}.`;
        this.channel.show();
        this.channel.appendLine(message);
      } catch (error) {
        throw new Error(
            `Deploy binary file to device ${RaspberryPiUploadConfig.user}@${
                RaspberryPiUploadConfig.host} failed. ${error.message}`);
      }

      await ssh.close();

      const message = `Successfully deploy bin file to Raspberry Pi board.`;
      this.channel.show();
      this.channel.appendLine(message);
      vscode.window.showInformationMessage(message);
    } catch (error) {
      throw new Error(`Upload device code failed. ${error.message}`);
    }

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

  async _autoDiscoverDeviceIp(): Promise<vscode.QuickPickItem[]> {
    const sshDevicePickItems: vscode.QuickPickItem[] = [];
    const deviceInfos = await sdk.SSH.discover();
    deviceInfos.forEach((deviceInfo) => {
      sshDevicePickItems.push({
        label: deviceInfo.ip as string,
        description: deviceInfo.host || '<Unknown>'
      });
    });

    sshDevicePickItems.push(
        {
          label: '$(sync) Discover again',
          detail: 'Auto discover SSH enabled device in LAN'
        },
        {
          label: '$(gear) Manual setup',
          detail: 'Setup device SSH configuration manually'
        });

    return sshDevicePickItems;
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
        const selectDeviceItems = this._autoDiscoverDeviceIp();
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
        prompt: `Please input Raspberry Pi device ip or hostname here.`,
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
    raspiPassword = raspiPassword || RaspberryPiUploadConfig.password;

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
      const projectFolderPath = this.projectFolder;

      if (!fs.existsSync(projectFolderPath)) {
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
        const configFilePath = path.join(projectFolderPath, 'config.json');
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