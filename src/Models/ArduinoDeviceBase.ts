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
import {runCommand} from '../utils';

import {Board} from './Interfaces/Board';
import {ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';
import {LibraryManageable} from './Interfaces/LibraryManageable';
import {TemplateFileInfo} from './Interfaces/ProjectTemplate';
import {OTA} from './OTA';

const constants = {
  defaultSketchFileName: 'device.ino',
  outputPath: './.build'
};


export abstract class ArduinoDeviceBase implements Device, LibraryManageable {
  protected deviceType: DeviceType;
  protected componentType: ComponentType;
  protected projectFolder: string;
  protected devcontainerFolderPath: string;
  protected vscodeFolderPath: string;
  protected boardFolderPath: string;
  protected outputPath: string;
  protected extensionContext: vscode.ExtensionContext;
  protected channel: vscode.OutputChannel;
  protected componentId: string;

  abstract name: string;
  abstract id: string;
  abstract board: Board | undefined;

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
    this.outputPath = 
        path.join(this.projectFolder, FileNames.outputPathName);
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
      if (this.board === undefined) {
        throw Error(`Device board is undefined.`);
      }

      if (!fs.existsSync(this.outputPath)) {
        try {
          fs.mkdirSync(this.outputPath);
        } catch (error) {
          throw Error(`Failed to create output path ${this.outputPath}. Error message: ${error.message}`);
        }
      }

      this.channel.show();
      this.channel.appendLine('### Compile arduino based device code');
      
      const command = `arduino-cli compile --fqbn ${this.board.model} ${this.projectFolder}/device --output ${this.outputPath}/output --debug`;
      await runCommand(command, '', this.channel);
    } catch (error) {
      throw Error(`Compile device code failed. Error message: ${error.message}`);
    }
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

  // Helper functions:
  generateCommonFiles(): void {
    if (!fs.existsSync(this.projectFolder)) {
      throw new Error('Unable to find the project folder.');
    }

    if (!fs.existsSync(this.vscodeFolderPath)) {      
      try {
        fs.mkdirSync(this.vscodeFolderPath);
      } catch (error) {
        throw Error(`Failed to create .vscode folder. Error message: ${error.message}`);
      }
    }

    if (!fs.existsSync(this.devcontainerFolderPath)) {
      try {
        fs.mkdirSync(this.devcontainerFolderPath);
      } catch (error) {
        throw Error(`Failed to create .devcontainer folder. Error message: ${error.message}`);
      }
    }
  }

  async generateCppPropertiesFile(board: Board): Promise<boolean> {
    // Create c_cpp_properties.json file
    const cppPropertiesFilePath =
        path.join(this.vscodeFolderPath, FileNames.cppPropertiesFileName);

    if (fs.existsSync(cppPropertiesFilePath)) {
      return true;
    }

    try {
      const propertiesSourceFile = path.join(
        this.boardFolderPath, board.id, FileNames.cppPropertiesFileName);
      const propertiesContent =
          fs.readFileSync(propertiesSourceFile).toString();
      fs.writeFileSync(cppPropertiesFilePath, propertiesContent);
    } catch (error) {
      throw new Error(`Create cpp properties file failed: ${error.message}`);
    }

    return true;
  }

  async generateDockerRelatedFiles(board: Board): Promise<boolean> {
        // Dockerfile       
        const dockerfileTargetPath = path.join(
          this.devcontainerFolderPath, FileNames.dockerfileName);

        if (fs.existsSync(dockerfileTargetPath)) {
          return true;
        }

        try {
          const dockerfileSourcePath = path.join(
            this.boardFolderPath, board.id, FileNames.dockerfileName);
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
            this.boardFolderPath, board.id, FileNames.devcontainerJSONFileName);
          const devcontainerJSONContent = fs.readFileSync(devcontainerJSONFileSourcePath, 'utf8');
          fs.writeFileSync(devcontainerJSONFileTargetPath, devcontainerJSONContent);
        } catch (error) {
          throw new Error(`Create devcontainer.json file failed: ${error.message}`);
        }

        return true;
  }

  async generateSketchFile(templateFilesInfo: TemplateFileInfo[]): Promise<boolean> {
    if (!templateFilesInfo) {
      throw new Error('No sketch file found.');
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