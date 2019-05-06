// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import {Guid} from 'guid-typescript';
import * as path from 'path';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, FileNames, PlatformType} from '../constants';
import {TemplateFileInfo} from './Interfaces/ProjectTemplate';

import {ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';
import {SSH} from './SSH';

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

  protected devcontainerFolderPath: string;
  protected vscodeFolderPath: string;
  protected boardFolderPath: string;

  static get boardId() {
    return RaspberryPiDevice._boardId;
  }

  constructor(
      context: vscode.ExtensionContext, projectPath: string,
      channel: vscode.OutputChannel, private templateFilesInfo: TemplateFileInfo[] = []) {
    this.deviceType = DeviceType.Raspberry_Pi;
    this.componentType = ComponentType.Device;
    this.projectFolder = projectPath;
    this.channel = channel;
    this.componentId = Guid.create().toString();
    this.devcontainerFolderPath = 
        path.join(this.projectFolder, FileNames.devcontainerFolderName);
    this.vscodeFolderPath =
        path.join(this.projectFolder, FileNames.vscodeSettingsFolderName);
    this.boardFolderPath = context.asAbsolutePath(
        path.join(FileNames.resourcesFolderName, PlatformType.LINUX));
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
    if (!fs.existsSync(this.projectFolder)) {
      throw new Error('Unable to find the project folder.');
    }

    this.generateCommonFiles();
    await this.generateDockerRelatedFiles();
    await this.generateCppPropertiesFile();

    return true;
  }

  async create(): Promise<boolean> {
    if (!fs.existsSync(this.projectFolder)) {
      throw new Error('Unable to find the project folder.');
    }
    
    this.generateCommonFiles();
    await this.generateCppPropertiesFile();
    await this.generateDockerRelatedFiles();
    await this.generateSketchFile(this.templateFilesInfo);

    return true;
  }

  // Helper function
  generateCommonFiles(): void {
    if (!fs.existsSync(this.vscodeFolderPath)) {
      fs.mkdirSync(this.vscodeFolderPath);
    }

    if (!fs.existsSync(this.devcontainerFolderPath)) {
      fs.mkdirSync(this.devcontainerFolderPath);
    }
  }

  async generateCppPropertiesFile(): Promise<boolean> {
    // Create c_cpp_properties.json file
    const cppPropertiesFilePath =
        path.join(this.vscodeFolderPath, FileNames.cppPropertiesFileName);

    if (fs.existsSync(cppPropertiesFilePath)) {
      return true;
    }

    try {
      const propertiesSourceFile = path.join(
        this.boardFolderPath, RaspberryPiDevice.boardId, FileNames.cppPropertiesFileName);
      const propertiesContent =
          fs.readFileSync(propertiesSourceFile).toString();
      fs.writeFileSync(cppPropertiesFilePath, propertiesContent);
    } catch (error) {
      throw new Error(`Create cpp properties file failed: ${error.message}`);
    }

    return true;
  }

  async generateDockerRelatedFiles(): Promise<boolean> {
        // Dockerfile       
        const dockerfileTargetPath = path.join(
          this.devcontainerFolderPath, FileNames.dockerfileName);

        if (fs.existsSync(dockerfileTargetPath)) {
          return true;
        }

        try {
          const dockerfileSourcePath = path.join(
            this.boardFolderPath, RaspberryPiDevice.boardId, FileNames.dockerfileName);
          const dockerfileContent = fs.readFileSync(dockerfileSourcePath, 'utf8');
          fs.writeFileSync(dockerfileTargetPath, dockerfileContent);
        } catch (error) {
          throw new Error(`Create Dockerfile failed: ${error.message}`);
        }
    
        // devcontainer.json
        const devcontainerJSONFileTargetPath = path.join(
          this.devcontainerFolderPath, FileNames.devcontainerJSONFileName);

        if (fs.existsSync(devcontainerJSONFileTargetPath)) {
          return true;
        }

        try {
          const devcontainerJSONFileSourcePath = path.join(
            this.boardFolderPath, RaspberryPiDevice.boardId, FileNames.devcontainerJSONFileName);
          const devcontainerJSONContent = fs.readFileSync(devcontainerJSONFileSourcePath, 'utf8');
          fs.writeFileSync(devcontainerJSONFileTargetPath, devcontainerJSONContent);
        } catch (error) {
          throw new Error(`Create devcontainer.json file failed: ${error.message}`);
        }

        return true;
  }
  
  async generateSketchFile(templateFilesInfo: TemplateFileInfo[]): Promise<boolean> {
    // Generate sketch file
    if (!templateFilesInfo) {
      throw new Error('No sketch file found.');
    }    
    templateFilesInfo.forEach(fileInfo => {
      const targetFilePath = path.join(
            this.projectFolder, fileInfo.targetPath, fileInfo.fileName);
      if (fileInfo.fileContent) {
        try {
          fs.writeFileSync(targetFilePath, fileInfo.fileContent);
        } catch (error) {
          throw new Error(
              `Create Raspberrypi sketch file failed: ${error.message}`);
        }
      }
    });

    return true;
  }

  async compile(): Promise<boolean> {
    await vscode.window.showInformationMessage(
        'Compiling device code for Raspberry Pi is not supported');
    return true;
  }

  async upload(): Promise<boolean> {
    if (!fs.existsSync(path.join(this.projectFolder, 'config.json'))) {
      const option = await vscode.window.showInformationMessage(
          'No config file found. Have you configured device connection string?',
          'Upload anyway', 'Cancel');
      if (option === 'Cancel') {
        return true;
      }
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
          this.projectFolder, RaspberryPiUploadConfig.projectPath as string);
    } else {
      await ssh.close();
      this.channel.appendLine('SSH connection failed.');
      return false;
    }

    let sshNpmInstalled: boolean;
    if (sshUploaded) {
      sshNpmInstalled = await ssh.shell(
          `cd ${RaspberryPiUploadConfig.projectPath} && npm install`);
    } else {
      await ssh.close();
      this.channel.appendLine('SFTP upload failed.');
      return false;
    }

    await ssh.close();
    if (this.channel) {
      this.channel.appendLine('Uploaded project to Raspberry Pi.');
    }

    vscode.window.showInformationMessage('Uploaded project to Raspberry Pi.');
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

  async configSSH(): Promise<boolean> {
    // Raspberry Pi host
    const raspiHostOption: vscode.InputBoxOptions = {
      value: RaspberryPiUploadConfig.host,
      prompt: `Please input Raspberry Pi ip or hostname here.`,
      ignoreFocusOut: true
    };
    let raspiHost = await vscode.window.showInputBox(raspiHostOption);
    if (raspiHost === undefined) {
      return false;
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