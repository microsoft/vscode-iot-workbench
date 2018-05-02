// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as os from 'os';
import * as path from 'path';

import {error} from 'util';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, FileNames} from '../constants';
import {ProjectTemplate, ProjectTemplateType} from '../Models/Interfaces/ProjectTemplate';
import {IoTProject} from '../Models/IoTProject';

import {Component, ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';
import {BoardProvider} from '../boardProvider';
import {Board} from './Interfaces/Board';
import {ArduinoDeviceBase} from './ArduinoDeviceBase';

const constants = {
  defaultBoardInfo: 'esp32:esp32:m5stack-core-esp32',
  defaultBoardConfig: 'FlashMode=qio,FlashFreq=80,UploadSpeed=921600,DebugLevel=none'
}

export class Esp32Device extends ArduinoDeviceBase {

  private sketchFileTemplateName = '';
  private static _boardId = 'esp32';

  static get boardId() {
    return Esp32Device._boardId;
  }

  get board() {
    const boardProvider = new BoardProvider(this.extensionContext);
    const esp32 = boardProvider.find({id: Esp32Device._boardId});
    return esp32;
  }

  name = 'Esp32Arduino';
  
  constructor(
    context: vscode.ExtensionContext, devicePath: string,
    sketchFileTemplateName?: string) {
      super(context, devicePath, DeviceType.IoT_Button);
      if (sketchFileTemplateName) {
        this.sketchFileTemplateName = sketchFileTemplateName;
      }
    }

    async load(): Promise<boolean> {
      const deviceFolderPath = this.deviceFolder;
  
      if (!fs.existsSync(deviceFolderPath)) {
        throw new Error('Unable to find the device folder inside the project.');
      }

      if(!this.board){
        throw new Error('Unable to find the board in the config file.');
      }

      this.generateCppPropertiesFile(this.board);
      return true;
    }

    async create(): Promise<boolean> {
      if (!this.sketchFileTemplateName) {
        throw new Error('No sketch file found.');
      }
      const deviceFolderPath = this.deviceFolder;

      if (!fs.existsSync(deviceFolderPath)) {
        throw new Error('Unable to find the device folder inside the project.');
      }    
      if(!this.board){
        throw new Error('Unable to find the board in the config file.');
      }

      this.generateCommonFiles();
      this.generateCppPropertiesFile(this.board);
      await this.generateSketchFile(this.sketchFileTemplateName, this.board,
        constants.defaultBoardInfo, constants.defaultBoardConfig);
      return true;
    }
  

    async configDeviceSettings(): Promise<boolean> {
      throw new Error(
        'Not implemented');
    }

    async preCompileAction():  Promise<boolean>{
      return true;
    }

    async preUploadAction(): Promise<boolean>{
      return true;
    }

}
