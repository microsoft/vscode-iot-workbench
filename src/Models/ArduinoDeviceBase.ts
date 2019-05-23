// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {ConnectionString} from 'azure-iothub';
import * as fs from 'fs-plus';
import {Guid} from 'guid-typescript';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {FileNames, PlatformType, OperationType} from '../constants';
import {DialogResponses} from '../DialogResponses';
import * as utils from '../utils';

import {Board} from './Interfaces/Board';
import {ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';
import {LibraryManageable} from './Interfaces/LibraryManageable';
import {TemplateFileInfo} from './Interfaces/ProjectTemplate';
import {OTA} from './OTA';
import * as sdk from 'vscode-iot-device-cube-sdk';
import { RemoteExtension } from './RemoteExtension';

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
    const isRemote = RemoteExtension.isRemote(this.extensionContext);
    if (!isRemote) {
      await utils.askAndOpenInRemote(OperationType.compile, this.channel);
      return false;
    }

    if (this.board === undefined) {
      throw new Error(`Device board is undefined.`);
    }

    if (!fs.existsSync(this.outputPath)) {
      try {
        fs.mkdirSync(this.outputPath);
      } catch (error) {
        throw new Error(`Failed to create output path ${this.outputPath}. Error message: ${error.message}`);
      }
    }

    this.channel.show();
    this.channel.appendLine('Compiling arduino based device code...');

    const command = `arduino-cli compile --fqbn ${this.board.model} ${this.projectFolder}/device --output ${this.outputPath}/output --verbose`;
    try {
      await utils.runCommand(command, '', this.channel);
    } catch (error) {
      throw new Error(`Compile device code failed. Error message: ${error.message}`);
    }

    return true;
  }


  async upload(): Promise<boolean> {
    const isRemote = RemoteExtension.isRemote(this.extensionContext);
    if (!isRemote) {
      await utils.askAndOpenInRemote(OperationType.upload, this.channel);
      return false;
    }

    return true;
  }

  async manageLibrary(): Promise<boolean> {
    // TODO: implement library management
    return true;
  }

  abstract async configDeviceSettings(): Promise<boolean>;

  abstract async load(): Promise<boolean>;
  abstract async create(): Promise<boolean>;

  abstract async preUploadAction(): Promise<boolean>;

  async generateSketchFile(templateFilesInfo: TemplateFileInfo[]): Promise<boolean> {
    if (!templateFilesInfo) {
      throw new Error('No sketch file found.');
    }

    // Cannot use forEach here since it's async
    for (const fileInfo of templateFilesInfo) {
      let targetFilePath = '';
      const targetFolderPath = path.join(this.projectFolder, fileInfo.targetPath);
      if (!await sdk.FileSystem.exists(targetFolderPath)) {
        await utils.mkdirRecursively(targetFolderPath);
      }

      if (fileInfo.fileName.endsWith('.ino')) {
        targetFilePath = path.join(targetFolderPath, constants.defaultSketchFileName);
      } else {
        targetFilePath = path.join(targetFolderPath, fileInfo.fileName);
      }
      if (fileInfo.fileContent) {
        try {
          await sdk.FileSystem.writeFile(targetFilePath, fileInfo.fileContent);
        } catch (error) {
          throw new Error(
              `Create arduino sketch file failed: ${error.message}`);
        }
      }
    }

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