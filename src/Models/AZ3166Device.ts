import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';
import {Component, ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';
import {ExceptionHelper} from '../exceptionHelper';

const constants = {
  defaltSketchFileName: 'myDevice.ino',
  arduinoJsonFileName: 'arduino.json',
  boardInfo: 'AZ3166:stm32f4:MXCHIP_AZ3166',
  uploadMethod: 'upload_method=OpenOCDMethod'
};

export class AZ3166Device implements Device {
  private deviceType: DeviceType;
  private componentType: ComponentType;
  private deviceFolder: string;

  constructor(devicePath: string) {
    this.deviceType = DeviceType.MXChip_AZ3166;
    this.componentType = ComponentType.Device;
    this.deviceFolder = devicePath;
  }

  getDeviceType(): DeviceType {
    return this.deviceType;
  }

  getComponentType(): ComponentType {
    return this.componentType;
  }

  load(): boolean {
    return true;
  }

  create(): boolean {
    const rootPath: string = vscode.workspace.rootPath as string;
    const deviceFolderPath = path.join(rootPath, this.deviceFolder);

    if (!fs.existsSync(deviceFolderPath)) {
      ExceptionHelper.logError(`Device folder doesn't exist: ${deviceFolderPath}`, true);
    }

    // Get arduino sketch file name from user input or use defalt sketch name
    const option: vscode.InputBoxOptions = {
      value: constants.defaltSketchFileName,
      prompt: `Please input device sketch file name here.`,
      ignoreFocusOut: true
    };

    vscode.window
      .showInputBox(option)
      .then(val => {
        const sketchFileName = val;

        // Create arduino.json config file
        const arduinoJsonFilePath = path.join(deviceFolderPath, constants.arduinoJsonFileName);
        const arduinoJsonObj = {
          'board': constants.boardInfo,
          'stetch': sketchFileName,
          'configuration': constants.uploadMethod
        };

        try
        {
          fs.writeFileSync(arduinoJsonFilePath, JSON.stringify(arduinoJsonObj, null, 4));
        }
        catch (error)
        {
          ExceptionHelper.logError(`Device: create arduino config file failed: ${error.message}`, true);
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
            vscode.commands.executeCommand(
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
            vscode.commands.executeCommand(
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
