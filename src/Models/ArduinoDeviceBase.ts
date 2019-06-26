// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, DependentExtensions, FileNames, platformFolderMap, PlatformType} from '../constants';

import {Board} from './Interfaces/Board';
import {ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';
import {OTA} from './OTA';

const constants = {
  defaultSketchFileName: 'device.ino',
  arduinoJsonFileName: 'arduino.json',
  cppPropertiesFileName: 'c_cpp_properties.json',
  cppPropertiesFileNameMac: 'c_cpp_properties_macos.json',
  cppPropertiesFileNameWin: 'c_cpp_properties_win32.json',
  outputPath: './.build'
};


export abstract class ArduinoDeviceBase implements Device {
  protected deviceType: DeviceType;
  protected componentType: ComponentType;
  protected deviceFolder: string;
  protected vscodeFolderPath: string;
  protected extensionContext: vscode.ExtensionContext;
  protected boardFolderPath: string;

  abstract name: string;
  abstract id: string;

  constructor(
      context: vscode.ExtensionContext, devicePath: string,
      deviceType: DeviceType) {
    this.deviceType = deviceType;
    this.componentType = ComponentType.Device;
    this.deviceFolder = devicePath;
    this.extensionContext = context;
    this.vscodeFolderPath =
        path.join(this.deviceFolder, FileNames.vscodeSettingsFolderName);

    const platformFolder = platformFolderMap.get(PlatformType.ARDUINO);
    if (platformFolder === undefined) {
      throw new Error(`Platform ${
          PlatformType.ARDUINO}'s  resource folder does not exist.`);
    }
    this.boardFolderPath = context.asAbsolutePath(
        path.join(FileNames.resourcesFolderName, platformFolder));
  }

  getDeviceType(): DeviceType {
    return this.deviceType;
  }

  getComponentType(): ComponentType {
    return this.componentType;
  }

  static async isAvailable(): Promise<boolean> {
    if (!vscode.extensions.getExtension(DependentExtensions.arduino)) {
      const choice = await vscode.window.showInformationMessage(
          'Arduino extension is required for the current project. Do you want to install it from marketplace?',
          'Yes', 'No');
      if (choice === 'Yes') {
        vscode.commands.executeCommand(
            'vscode.open',
            vscode.Uri.parse(
                'vscode:extension/' + DependentExtensions.arduino));
      }
      return false;
    }

    return true;
  }

  async checkPrerequisites(): Promise<boolean> {
    const isArduinoExtensionAvailable = await ArduinoDeviceBase.isAvailable();
    if (!isArduinoExtensionAvailable) {
      return false;
    }

    return true;
  }

  async compile(): Promise<boolean> {
    try {
      const result = await this.preCompileAction();
      if (!result) {
        return false;
      }
      await vscode.commands.executeCommand('arduino.verify');
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
          path.join(deviceFolderPath, FileNames.iotworkspaceProjectFileName);
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
        const propertiesFilePathWin32 =
            this.extensionContext.asAbsolutePath(path.join(
                FileNames.resourcesFolderName, board.id,
                constants.cppPropertiesFileNameWin));
        const propertiesContentWin32 =
            fs.readFileSync(propertiesFilePathWin32).toString();
        const rootPathPattern = /{ROOTPATH}/g;
        const versionPattern = /{VERSION}/g;
        const homeDir = os.homedir();
        const localAppData: string = path.join(homeDir, 'AppData', 'Local');
        const replaceStr =
            propertiesContentWin32
                .replace(rootPathPattern, localAppData.replace(/\\/g, '\\\\'))
                .replace(versionPattern, this.version);
        fs.writeFileSync(cppPropertiesFilePath, replaceStr);
      }
      // TODO: Let's use the same file for Linux and MacOS for now. Need to
      // revisit this part.
      else {
        const propertiesFilePathMac =
            this.extensionContext.asAbsolutePath(path.join(
                FileNames.resourcesFolderName, board.id,
                constants.cppPropertiesFileNameMac));
        const propertiesContentMac =
            fs.readFileSync(propertiesFilePathMac).toString();
        fs.writeFileSync(cppPropertiesFilePath, propertiesContentMac);
      }
    } catch (error) {
      throw new Error(`Create cpp properties file failed: ${error.message}`);
    }
  }

  async generateSketchFile(
      sketchTemplateFileName: string, board: Board, boardInfo: string,
      boardConfig: string): Promise<boolean> {
    // Create arduino.json config file
    const arduinoJSONFilePath =
        path.join(this.vscodeFolderPath, constants.arduinoJsonFileName);
    const arduinoJSONObj = {
      'board': boardInfo,
      'sketch': constants.defaultSketchFileName,
      'configuration': boardConfig,
      'output': constants.outputPath
    };

    try {
      fs.writeFileSync(
          arduinoJSONFilePath, JSON.stringify(arduinoJSONObj, null, 4));
    } catch (error) {
      throw new Error(
          `Device: create arduino config file failed: ${error.message}`);
    }

    // Create settings.json config file
    const settingsJSONFilePath =
        path.join(this.vscodeFolderPath, FileNames.settingsJsonFileName);
    const settingsJSONObj = {
      'files.exclude': {'.build': true, '.iotworkbenchproject': true}
    };

    try {
      fs.writeFileSync(
          settingsJSONFilePath, JSON.stringify(settingsJSONObj, null, 4));
    } catch (error) {
      throw new Error(
          `Device: create arduino config file failed: ${error.message}`);
    }

    // Create an empty arduino sketch
    const sketchTemplateFilePath =
        this.extensionContext.asAbsolutePath(path.join(
            FileNames.resourcesFolderName, board.id, sketchTemplateFileName));
    const newSketchFilePath =
        path.join(this.deviceFolder, constants.defaultSketchFileName);

    try {
      const content = fs.readFileSync(sketchTemplateFilePath).toString();
      fs.writeFileSync(newSketchFilePath, content);
    } catch (error) {
      throw new Error(`Create arduino sketch file failed: ${error.message}`);
    }
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