// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {ConnectionString} from 'azure-iothub';
import * as fs from 'fs-plus';
import {Guid} from 'guid-typescript';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {FileNames, PlatformType} from '../constants';
import {DialogResponses} from '../DialogResponses';

import {Board} from './Interfaces/Board';
import {ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';
import {LibraryManageable} from './Interfaces/LibraryManageable';
import {TemplateFileInfo} from './Interfaces/ProjectTemplate';
import {OTA} from './OTA';

const constants = {
  defaultSketchFileName: 'device.ino',
  arduinoJsonFileName: 'arduino.json',
  cppPropertiesFileName: 'c_cpp_properties.json',
  cppPropertiesFileNameMac: 'c_cpp_properties_macos.json',
  cppPropertiesFileNameWin: 'c_cpp_properties_win32.json',
  outputPath: './.build'
};


export abstract class ArduinoDeviceBase implements Device, LibraryManageable {
  protected deviceType: DeviceType;
  protected componentType: ComponentType;
  protected projectFolder: string;
  protected devcontainerFolderPath: string;
  protected vscodeFolderPath: string;
  protected boardFolderPath: string;
  protected extensionContext: vscode.ExtensionContext;
  protected channel: vscode.OutputChannel;
  protected componentId: string;

  abstract name: string;
  abstract id: string;

  constructor(
      context: vscode.ExtensionContext, projectPath: string,
      channel: vscode.OutputChannel, deviceType: DeviceType) {
    this.deviceType = deviceType;
    this.componentType = ComponentType.Device;
    this.projectFolder = projectPath;
    this.extensionContext = context;
    this.channel = channel;
    this.componentId = Guid.create().toString();
    this.devcontainerFolderPath = 
        path.join(this.projectFolder, FileNames.devcontainerFolderName);
    this.vscodeFolderPath =
        path.join(this.projectFolder, FileNames.vscodeSettingsFolderName);
    this.boardFolderPath = context.asAbsolutePath(
        path.join(FileNames.resourcesFolderName, PlatformType.ARDUINO));
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
    return true;
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

  async manageLibrary(): Promise<boolean> {
    // try {
    //   // const libraryList;
    //   await this.docker
    //     .command(`run --name ${this.containerName} -v ${
    //       this.arduinoPackagePath}:/root/ ${this.imageName} lib search`).then((data) => {

    //       });
    // } catch (error) {
    //   throw error;
    // }
    return true;
  }

  abstract async configDeviceSettings(): Promise<boolean>;

  abstract async load(): Promise<boolean>;
  abstract async create(): Promise<boolean>;

  abstract async preUploadAction(): Promise<boolean>;

  abstract get version(): string;

  // Helper functions:
  generateCommonFiles(): void {
    if (!fs.existsSync(this.projectFolder)) {
      throw new Error('Unable to find the project folder.');
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
        const versionPattern = /{VERSION}/g;
        const replaceStr =
            propertiesContentWin32.replace(versionPattern, this.version);
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
    // Generate docker related file: Dockerfile & devcontainer.json
    if (!fs.existsSync(this.devcontainerFolderPath)) {
      fs.mkdirSync(this.devcontainerFolderPath);
    }
  
    const dockerfileSourcePath = path.join(
      this.boardFolderPath, board.id, FileNames.dockerfileName);
    const dockerfileTargetPath = path.join(
      this.devcontainerFolderPath, FileNames.dockerfileName);
    if (fs.existsSync(dockerfileSourcePath)) {
      try {
        const dockerfileContent = fs.readFileSync(dockerfileSourcePath, 'utf8');
        fs.writeFileSync(dockerfileTargetPath, dockerfileContent);
      } catch (error) {
        throw new Error(`Create Dockerfile failed: ${error.message}`);
      }
    } else {
      throw new Error(`Cannot find Dockerfile template file.`);
    }

    const devcontainerJSONFileSourcePath = path.join(
      this.boardFolderPath, board.id, FileNames.devcontainerJSONFileName);
    const devcontainerJSONFileTargetPath = path.join(
      this.devcontainerFolderPath, FileNames.devcontainerJSONFileName);
    if (fs.existsSync(devcontainerJSONFileSourcePath)) {
      try {
        const devcontainerJSONContent = fs.readFileSync(devcontainerJSONFileSourcePath, 'utf8');
        fs.writeFileSync(devcontainerJSONFileTargetPath, devcontainerJSONContent);
      } catch (error) {
        throw new Error(`Create devcontainer.json file failed: ${error.message}`);
      }
    } else {
      throw new Error(`Cannot find devcontainer json source file.`);
    }

    templateFilesInfo.forEach(fileInfo => {
      let targetFilePath = '';
      if (fileInfo.fileName.endsWith('.ino')) {
        targetFilePath = path.join(
            this.projectFolder, fileInfo.targetPath,
            constants.defaultSketchFileName);
      } else {
        targetFilePath = path.join(
            this.projectFolder, fileInfo.targetPath, fileInfo.fileName);
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

    return true;
  }

  async generateCrc(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel) {
    // if (!vscode.workspace.workspaceFolders) {
    //   vscode.window.showWarningMessage('No workspace opened.');
    //   channel.show();
    //   channel.appendLine('No workspace opened.');
    //   return false;
    // }

    // const projectPath = ConfigHandler.get<string>(ConfigKey.projectPath);
    // if (!projectPath) {
    //   vscode.window.showWarningMessage(
    //       'No device path found in workspace configuration.');
    //   channel.show();
    //   channel.appendLine('No device path found in workspace configuration.');
    //   return false;
    // }
    // const deviceBuildLocation = path.join(
    //     vscode.workspace.workspaceFolders[0].uri.fsPath, '..', projectPath,
    //     '.build');

    // if (!deviceBuildLocation) {
    //   vscode.window.showWarningMessage(
    //       'No device compile output folder found.');
    //   channel.show();
    //   channel.appendLine('No device compile output folder found.');
    //   return false;
    // }

    // const binFiles = fs.listSync(deviceBuildLocation, ['bin']);
    // if (!binFiles || !binFiles.length) {
    //   const message =
    //       'No bin file found. Please run the command of Device Compile first.';
    //   vscode.window.showWarningMessage(message);
    //   channel.show();
    //   channel.appendLine(message);
    //   return false;
    // }

    // let binFilePath = '';

    // if (binFiles.length === 1) {
    //   binFilePath = binFiles[0];
    // } else {
    //   const binFilePickItems: vscode.QuickPickItem[] = [];
    //   for (const file of binFiles) {
    //     const fileName = path.basename(file);
    //     binFilePickItems.push({label: fileName, description: file});
    //   }

    //   const choice = await vscode.window.showQuickPick(binFilePickItems, {
    //     ignoreFocusOut: true,
    //     matchOnDescription: true,
    //     matchOnDetail: true,
    //     placeHolder: 'Select bin file',
    //   });

    //   if (!choice || !choice.description) {
    //     return false;
    //   }

    //   binFilePath = choice.description;
    // }

    // if (!binFilePath || !fs.existsSync(binFilePath)) {
    //   return false;
    // }

    // const res = OTA.generateCrc(binFilePath);

    // vscode.window.showInformationMessage('Generate CRC succeeded.');

    // channel.show();
    // channel.appendLine('========== CRC Information ==========');
    // channel.appendLine('');
    // channel.appendLine('fwPath: ' + binFilePath);
    // channel.appendLine('fwPackageCheckValue: ' + res.crc);
    // channel.appendLine('fwSize: ' + res.size);
    // channel.appendLine('');
    // channel.appendLine('======================================');

    return true;
  }
}