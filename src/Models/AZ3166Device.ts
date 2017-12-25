import * as fs from 'fs-plus';
import * as path from 'path';
import {error} from 'util';
import * as vscode from 'vscode';

import {ExceptionHelper} from '../exceptionHelper';
import {IoTProject, ProjectTemplateType} from '../Models/IoTProject';

import {Component, ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';

const constants = {
  vscodeSettingsFolderName: '.vscode',
  defaultSketchFileName: 'device.ino',
  arduinoJsonFileName: 'arduino.json',
  boardInfo: 'AZ3166:stm32f4:MXCHIP_AZ3166',
  uploadMethod: 'upload_method=OpenOCDMethod',
  resourcesFolderName: 'resources',
  sketchTemplateFileName: 'emptySketch.ino'
};

export class AZ3166Device implements Device {
  private deviceType: DeviceType;
  private componentType: ComponentType;
  private deviceFolder: string;
  private extensionContext: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext, devicePath: string) {
    this.deviceType = DeviceType.MXChip_AZ3166;
    this.componentType = ComponentType.Device;
    this.deviceFolder = devicePath;
    this.extensionContext = context;
  }

  getDeviceType(): DeviceType {
    return this.deviceType;
  }

  getComponentType(): ComponentType {
    return this.componentType;
  }

  async load(): Promise<boolean> {
    return new Promise(
        async (
            resolve: (value: boolean) => void,
            reject: (value: boolean) => void) => {
          try {
            await vscode.commands.executeCommand(
                'arduino.iotStudioInitialize', this.deviceFolder);
            resolve(true);
          } catch (error) {
            ExceptionHelper.logError(error, true);
            reject(false);
          }
        });
  }

  create(): boolean {
    const rootPath: string = vscode.workspace.rootPath as string;
    const deviceFolderPath = path.join(rootPath, this.deviceFolder);

    if (!fs.existsSync(deviceFolderPath)) {
      ExceptionHelper.logError(
          `Device folder doesn't exist: ${deviceFolderPath}`, true);
    }

    const vscodeFolderPath =
        path.join(deviceFolderPath, constants.vscodeSettingsFolderName);
    if (!fs.existsSync(vscodeFolderPath)) {
      fs.mkdirSync(vscodeFolderPath);
    }

    // Get arduino sketch file name from user input or use defalt sketch name
    const option: vscode.InputBoxOptions = {
      value: constants.defaultSketchFileName,
      prompt: `Please input device sketch file name here.`,
      ignoreFocusOut: true
    };

    vscode.window.showInputBox(option).then(val => {
      let sketchFileName: string = constants.defaultSketchFileName;
      if (val !== undefined) {
        const fileExt = val.split('.').pop();
        if (fileExt !== 'ino') {
          val = val + '.ino';
        }

        sketchFileName = val;
      }

      // Create arduino.json config file
      const arduinoJSONFilePath =
          path.join(vscodeFolderPath, constants.arduinoJsonFileName);
      const arduinoJSONObj = {
        'board': constants.boardInfo,
        'sketch': sketchFileName,
        'configuration': constants.uploadMethod
      };

      try {
        fs.writeFileSync(
            arduinoJSONFilePath, JSON.stringify(arduinoJSONObj, null, 4));
      } catch (error) {
        ExceptionHelper.logError(
            `Device: create arduino config file failed: ${error.message}`,
            true);
      }

      // Create an empty arduino sketch
      const sketchTemplateFilePath =
          this.extensionContext.asAbsolutePath(path.join(
              constants.resourcesFolderName, constants.sketchTemplateFileName));
      const newSketchFilePath = path.join(deviceFolderPath, sketchFileName);

      try {
        const content = fs.readFileSync(sketchTemplateFilePath).toString();
        fs.writeFileSync(newSketchFilePath, content);
        vscode.commands.executeCommand(
            'arduino.iotStudioInitialize', this.deviceFolder);
      } catch (error) {
        ExceptionHelper.logError('Create arduino sketch file failed.', true);
      }
    });

    return true;
  }

  async compile(): Promise<boolean> {
    return new Promise(
        async (
            resolve: (value: boolean) => void,
            reject: (value: boolean) => void) => {
          try {
            await vscode.commands.executeCommand(
                'arduino.iotStudioInitialize', this.deviceFolder);
            await vscode.commands.executeCommand('arduino.verify');
            resolve(true);
          } catch (error) {
            ExceptionHelper.logError(error, true);
            reject(false);
          }
        });
  }

  async upload(): Promise<boolean> {
    return new Promise(
        async (
            resolve: (value: boolean) => void,
            reject: (value: boolean) => void) => {
          try {
            await vscode.commands.executeCommand(
                'arduino.iotStudioInitialize', this.deviceFolder);
            await vscode.commands.executeCommand('arduino.upload');
            resolve(true);
          } catch (error) {
            ExceptionHelper.logError(error, true);
            reject(false);
          }
        });
  }
}
