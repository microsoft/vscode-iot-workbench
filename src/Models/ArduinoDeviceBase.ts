// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as os from 'os';
import * as path from 'path';
import {error} from 'util';
import * as vscode from 'vscode';

import {BoardProvider} from '../boardProvider';
import {ConfigHandler} from '../configHandler';
import {ConfigKey, FileNames} from '../constants';
import {ProjectTemplate, ProjectTemplateType} from '../Models/Interfaces/ProjectTemplate';
import {IoTProject} from '../Models/IoTProject';

import {Board} from './Interfaces/Board';
import {Component, ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';

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
  protected extensionContext: vscode.ExtensionContext;

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
  }

  getDeviceType(): DeviceType {
    return this.deviceType;
  }

  getComponentType(): ComponentType {
    return this.componentType;
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
    // Get arduino sketch file name from user input or use defalt sketch name
    const option: vscode.InputBoxOptions = {
      value: constants.defaultSketchFileName,
      prompt: `Please input device sketch file name here.`,
      ignoreFocusOut: true,
      validateInput: (sketchFileName: string) => {
        if (!sketchFileName ||
            /^([a-z_]|[a-z_][-a-z0-9_.]*[a-z0-9_])(\.ino)?$/i.test(
                sketchFileName)) {
          return '';
        }
        return 'Sketch file name can only contain alphanumeric and cannot start with number.';
      }
    };

    let sketchFileName = await vscode.window.showInputBox(option);


    if (sketchFileName === undefined) {
      return false;
    } else if (!sketchFileName) {
      sketchFileName = constants.defaultSketchFileName;
    } else {
      sketchFileName = sketchFileName.trim();
      if (!/\.ino$/i.test(sketchFileName)) {
        sketchFileName += '.ino';
      }
    }

    // Create arduino.json config file
    const arduinoJSONFilePath =
        path.join(this.vscodeFolderPath, constants.arduinoJsonFileName);
    const arduinoJSONObj = {
      'board': boardInfo,
      'sketch': sketchFileName,
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
    const newSketchFilePath = path.join(this.deviceFolder, sketchFileName);

    try {
      const content = fs.readFileSync(sketchTemplateFilePath).toString();
      fs.writeFileSync(newSketchFilePath, content);
    } catch (error) {
      throw new Error(`Create arduino sketch file failed: ${error.message}`);
    }
    return true;
  }
}