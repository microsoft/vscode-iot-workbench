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

export class Esp32Device implements Device {
  private deviceType: DeviceType;
  private componentType: ComponentType;
  private deviceFolder: string;
  private extensionContext: vscode.ExtensionContext;

  private static _boardId = 'esp32';

  static get boardId() {
    return Esp32Device._boardId;
  }

  name = 'Esp32Arduino';
  constructor(
    context: vscode.ExtensionContext, devicePath: string,
    inputFileName?: string) {
      this.deviceType = DeviceType.IoT_Button;
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
      const deviceFolderPath = this.deviceFolder;
  
      if (!fs.existsSync(deviceFolderPath)) {
        throw new Error('Unable to find the device folder inside the project.');
      }
      return true;
    }

    async create(): Promise<boolean> {
      throw new Error(
          'Compiling device code for Azure IoT Button is not supported');
    }
  

    async compile(): Promise<boolean> {
      throw new Error(
          'Compiling device code for Azure IoT Button is not supported');
    }
  
    async upload(): Promise<boolean> {
      throw new Error(
          'Uploading device code for Azure IoT Button is not supported');
    }

    async configDeviceSettings(): Promise<boolean> {
      throw new Error(
        'Uploading device code for Azure IoT Button is not supported');
    }

}
