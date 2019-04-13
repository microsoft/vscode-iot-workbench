// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {ConnectionString} from 'azure-iothub';
import {Docker, Options} from 'docker-cli-js';
import * as fs from 'fs-plus';
import {Guid} from 'guid-typescript';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, DependentExtensions, DockerCacheConfig, FileNames, PlatformType} from '../constants';

import {Board} from './Interfaces/Board';
import {ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';
import {TemplateFileInfo} from './Interfaces/ProjectTemplate';
import {OTA} from './OTA';
import {DialogResponses} from '../DialogResponses';

const constants = {
  defaultSketchFileName: 'device.ino',
  arduinoJsonFileName: 'arduino.json',
  cppPropertiesFileName: 'c_cpp_properties.json',
  cppPropertiesFileNameMac: 'c_cpp_properties_macos.json',
  cppPropertiesFileNameWin: 'c_cpp_properties_win32.json',
  outputPath: './.build',
};


export abstract class ArduinoDeviceBase implements Device {
  protected deviceType: DeviceType;
  protected componentType: ComponentType;
  protected deviceFolder: string;
  protected vscodeFolderPath: string;
  protected arduinoPackagePath: string;
  protected boardFolderPath: string;
  protected extensionContext: vscode.ExtensionContext;
  protected channel: vscode.OutputChannel;
  protected docker: Docker;
  protected componentId: string;
  private projectName: string;

  abstract name: string;
  abstract id: string;

  constructor(
      context: vscode.ExtensionContext, devicePath: string,
      channel: vscode.OutputChannel, deviceType: DeviceType) {
    this.deviceType = deviceType;
    this.componentType = ComponentType.Device;
    this.deviceFolder = devicePath;
    this.extensionContext = context;
    this.channel = channel;
    this.componentId = Guid.create().toString();
    this.vscodeFolderPath =
        path.join(this.deviceFolder, FileNames.vscodeSettingsFolderName);
    this.arduinoPackagePath =
        path.join(this.vscodeFolderPath, DockerCacheConfig.arduinoPackagePath);
    this.boardFolderPath = context.asAbsolutePath(
        path.join(FileNames.resourcesFolderName, PlatformType.ARDUINO));
    const pathSplit = devicePath.split('\\');
    this.projectName = pathSplit[pathSplit.length - 2];
    const options = new Options('', this.deviceFolder);
    this.docker = new Docker(options);
  }

  getDeviceType(): DeviceType {
    return this.deviceType;
  }

  getComponentType(): ComponentType {
    return this.componentType;
  }

  async checkPrerequisites(): Promise<boolean> {
    return true;
  }

  async compile(): Promise<boolean> {
    try {
      const result = await this.preCompileAction();
      if (!result) {
        return false;
      }

      // Step 1: check whether docker is installed
      this.channel.show();
      this.channel.appendLine('Check whether Docker is installed...');
      let dockerInstalled = false;
      await this.docker.command(`--version`).then((data) => {
        dockerInstalled = true;
        this.channel.show();
        this.channel.appendLine(data.raw);
        this.channel.appendLine(`##debug## Docker client is installed.`);
      });
      if (!dockerInstalled) {
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

      // Step 2: Check image successfully build. If not, build it.
      if (!this.projectName) {
        this.channel.show();
        this.channel.appendLine(`ProjectName is invalid: ${this.projectName}`);
        return false;
      }
      const imageName =
          `${DockerCacheConfig.arduinoAppDockerImage}:${this.projectName}`;
      const containerName = `${this.projectName}`;
      let imageExist = false;
      await this.docker.command(`images -q ${imageName}`).then((data) => {
        if (data.raw === '') {
          this.channel.show();
          this.channel.appendLine(data.raw);
          this.channel.appendLine(`##debug## image has not been built.`);
        } else {
          imageExist = true;
        }
      }).catch((err) => {
        this.channel.show();
        this.channel.appendLine(`Fail to check image existence. Error message: ${err}`);
        return false;
      });

      if (!imageExist) {
        // Build app image
        await this.docker.command(`build -t ${imageName} .`).then((data) => {
          this.channel.show();
          this.channel.appendLine(data.raw);
          this.channel.appendLine(
              `##debug## Build docker app image ${imageName}`);
        }).catch((err) => {
          this.channel.show();
          this.channel.appendLine(`Fail to build docker app image ${imageName}. Error message: ${err}`);
          return false;
        });
      }

      // Step 3: Compile application
      if (!fs.existsSync(this.arduinoPackagePath)) {
        fs.mkdirSync(this.arduinoPackagePath);
      }

      this.channel.show();
      this.channel.appendLine('Compile the application...');
      this.channel.appendLine('This may take a while. Please be patient...');

      await this.docker
          .command(`run --name ${containerName} -v ${
              this.arduinoPackagePath}:/root/ ${imageName}`)
          .then((data) => {
            this.channel.show();
            this.channel.appendLine(data.raw);
            this.channel.appendLine(`##debug## Compile application.`);
          }).catch((err) => {
            this.channel.show();
            this.channel.appendLine(`Fail to run compilation. Container name: ${containerName}. Error message: ${err}`);
            return false;
          });

      // Step 4: Copy binary file to local      
      if (!fs.existsSync(this.deviceFolder)) {
        this.channel.show();
        this.channel.appendLine(`Unable to find the device folder inside the project.`);
        return false;
      }
      try {
        const outputFilePath =
            path.join(this.deviceFolder, DockerCacheConfig.outputPath);
        fs.mkdirSync(outputFilePath);
      } catch (error) {
        this.channel.show();
        this.channel.appendLine(`Fail to create output path.`);
        return false;
      }
      await this.docker.command(`cp ${containerName}:/work/device/ ./${DockerCacheConfig.outputPath}`)
          .then((data) => {
            this.channel.show();
            this.channel.appendLine(`##debug## Copy binary file to local finish.`);
          });

      // Step 5: Clean up docker container
      await this.docker.command(`container rm ${containerName}`)
          .then((data) => {
            this.channel.show();
            this.channel.appendLine(
                `##debug## Container ${containerName} has been clean.`);
          });
      return true;
    } catch (error) {
      throw error;
    }
  }


  async upload(): Promise<boolean> {
    try {
      const result = await this.preUploadAction();
      if (!result) {
        return false;
      }
      await vscode.commands.executeCommand('arduino.upload');
      return true;
    } catch (error) {
      throw error;
    }
  }


  abstract async configDeviceSettings(): Promise<boolean>;

  abstract async load(): Promise<boolean>;
  abstract async create(): Promise<boolean>;

  abstract async preCompileAction(): Promise<boolean>;

  abstract async preUploadAction(): Promise<boolean>;

  abstract get version(): string;

  // Helper functions:
  generateCommonFiles(): void {
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

    if (!fs.existsSync(this.vscodeFolderPath)) {
      fs.mkdirSync(this.vscodeFolderPath);
    }
  }

  generateCppPropertiesFile(board: Board): void {
    // Create c_cpp_properties.json file
    const cppPropertiesFilePath =
        path.join(this.vscodeFolderPath, constants.cppPropertiesFileName);

    if (fs.existsSync(cppPropertiesFilePath)) {
      return;
    }

    try {
      const plat = os.platform();

      if (plat === 'win32') {
        const propertiesFilePathWin32 = path.join(
            this.boardFolderPath, board.id, constants.cppPropertiesFileNameWin);
        const propertiesContentWin32 =
            fs.readFileSync(propertiesFilePathWin32).toString();
        const cacheFolderPattern = /{CACHEFOLDER}/g;
        const versionPattern = /{VERSION}/g;
        const cacheFolder = path.join(
                                    FileNames.vscodeSettingsFolderName,
                                    DockerCacheConfig.arduinoPackagePath)
                                .replace(/\\/g, '\\\\');
        const replaceStr =
            propertiesContentWin32.replace(cacheFolderPattern, cacheFolder)
                .replace(versionPattern, this.version);
        fs.writeFileSync(cppPropertiesFilePath, replaceStr);
      }
      // TODO: Let's use the same file for Linux and MacOS for now. Need to
      // revisit this part.
      else {
        const propertiesFilePathMac = path.join(
            this.boardFolderPath, board.id, constants.cppPropertiesFileNameMac);
        const propertiesContentMac =
            fs.readFileSync(propertiesFilePathMac).toString();
        fs.writeFileSync(cppPropertiesFilePath, propertiesContentMac);
      }
    } catch (error) {
      throw new Error(`Create cpp properties file failed: ${error.message}`);
    }
  }

  async generateSketchFile(
      templateFilesInfo: TemplateFileInfo[], board: Board, boardInfo: string,
      boardConfig: string): Promise<boolean> {
    // // Create arduino.json config file
    // const arduinoJSONFilePath =
    //     path.join(this.vscodeFolderPath, constants.arduinoJsonFileName);
    // const arduinoJSONObj = {
    //   'board': boardInfo,
    //   'sketch': constants.defaultSketchFileName,
    //   'configuration': boardConfig,
    //   'output': constants.outputPath
    // };

    // try {
    //   fs.writeFileSync(
    //       arduinoJSONFilePath, JSON.stringify(arduinoJSONObj, null, 4));
    // } catch (error) {
    //   throw new Error(
    //       `Device: create arduino config file failed: ${error.message}`);
    // }

    // // Create settings.json config file
    // const settingsJSONFilePath =
    //     path.join(this.vscodeFolderPath, FileNames.settingsJsonFileName);
    // const settingsJSONObj = {
    //   'files.exclude': {'.build': true, '.iotworkbenchproject': true}
    // };

    // try {
    //   fs.writeFileSync(
    //       settingsJSONFilePath, JSON.stringify(settingsJSONObj, null, 4));
    // } catch (error) {
    //   throw new Error(
    //       `Device: create arduino config file failed: ${error.message}`);
    // }

    templateFilesInfo.forEach(fileInfo => {
      let targetFilePath = '';
      if (fileInfo.fileName.endsWith('.ino')) {
        targetFilePath = path.join(
            this.deviceFolder, fileInfo.targetPath,
            constants.defaultSketchFileName);
      } else {
        targetFilePath = path.join(
            this.deviceFolder, fileInfo.targetPath, fileInfo.fileName);
      }
      if (fileInfo.fileContent) {
        try {
          fs.writeFileSync(targetFilePath, fileInfo.fileContent);
        } catch (error) {
          throw new Error(
              `Create arduino sketch file failed: ${error.message}`);
        }
      }
    });

    // Create
    return true;
  }

  async generateCrc(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel) {
    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showWarningMessage('No workspace opened.');
      channel.show();
      channel.appendLine('No workspace opened.');
      return false;
    }

    const devicePath = ConfigHandler.get<string>(ConfigKey.devicePath);
    if (!devicePath) {
      vscode.window.showWarningMessage(
          'No device path found in workspace configuration.');
      channel.show();
      channel.appendLine('No device path found in workspace configuration.');
      return false;
    }
    const deviceBuildLocation = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath, '..', devicePath,
        '.build');

    if (!deviceBuildLocation) {
      vscode.window.showWarningMessage(
          'No device compile output folder found.');
      channel.show();
      channel.appendLine('No device compile output folder found.');
      return false;
    }

    const binFiles = fs.listSync(deviceBuildLocation, ['bin']);
    if (!binFiles || !binFiles.length) {
      const message =
          'No bin file found. Please run the command of Device Compile first.';
      vscode.window.showWarningMessage(message);
      channel.show();
      channel.appendLine(message);
      return false;
    }

    let binFilePath = '';

    if (binFiles.length === 1) {
      binFilePath = binFiles[0];
    } else {
      const binFilePickItems: vscode.QuickPickItem[] = [];
      for (const file of binFiles) {
        const fileName = path.basename(file);
        binFilePickItems.push({label: fileName, description: file});
      }

      const choice = await vscode.window.showQuickPick(binFilePickItems, {
        ignoreFocusOut: true,
        matchOnDescription: true,
        matchOnDetail: true,
        placeHolder: 'Select bin file',
      });

      if (!choice || !choice.description) {
        return false;
      }

      binFilePath = choice.description;
    }

    if (!binFilePath || !fs.existsSync(binFilePath)) {
      return false;
    }

    const res = OTA.generateCrc(binFilePath);

    vscode.window.showInformationMessage('Generate CRC succeeded.');

    channel.show();
    channel.appendLine('========== CRC Information ==========');
    channel.appendLine('');
    channel.appendLine('fwPath: ' + binFilePath);
    channel.appendLine('fwPackageCheckValue: ' + res.crc);
    channel.appendLine('fwSize: ' + res.size);
    channel.appendLine('');
    channel.appendLine('======================================');

    return true;
  }
}