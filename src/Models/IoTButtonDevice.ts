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

const constants = {
  accessPointHost: 'http://192.168.4.1',
  requestHead:
      {'Content-type': 'application/json', 'Accept': 'application/json'}
};


export class IoTButtonDevice implements Device {
  private deviceType: DeviceType;
  private componentType: ComponentType;
  private deviceFolder: string;
  private extensionContext: vscode.ExtensionContext;
  private inputFileName = '';

  private static _boardId = 'iotbutton';

  static get boardId() {
    return IoTButtonDevice._boardId;
  }

  constructor(
      context: vscode.ExtensionContext, devicePath: string,
      inputFileName?: string) {
    this.deviceType = DeviceType.IoT_Button;
    this.componentType = ComponentType.Device;
    this.deviceFolder = devicePath;
    this.extensionContext = context;
    if (inputFileName) {
      this.inputFileName = inputFileName;
    }
  }

  name = 'IoTButton';

  getDeviceType(): DeviceType {
    return this.deviceType;
  }

  getComponentType(): ComponentType {
    return this.componentType;
  }

  async load(): Promise<boolean> {
    const deviceFolderPath = this.deviceFolder;

    if (!fs.existsSync(deviceFolderPath)) {
      throw new Error(`Device folder doesn't exist: ${deviceFolderPath}`);
    }
    return true;
  }

  async create(): Promise<boolean> {
    if (!this.inputFileName) {
      throw new Error('No user data file found.');
    }
    const deviceFolderPath = this.deviceFolder;

    if (!fs.existsSync(deviceFolderPath)) {
      throw new Error(`Device folder doesn't exist: ${deviceFolderPath}`);
    }

    try {
      const iotworkbenchprojectFilePath =
          path.join(deviceFolderPath, FileNames.iotworkbenchprojectFileName);
      fs.writeFileSync(iotworkbenchprojectFilePath, ' ');
    } catch (error) {
      throw new Error(
          `Device: create iotworkbenchproject file failed: ${error.message}`);
    }

    // Create an empty userdata.json
    const userdataJsonFilePath = this.extensionContext.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, IoTButtonDevice._boardId,
        this.inputFileName));
    const newUserdataPath = path.join(deviceFolderPath, this.inputFileName);

    try {
      const content = fs.readFileSync(userdataJsonFilePath).toString();
      fs.writeFileSync(newUserdataPath, content);
    } catch (error) {
      throw new Error(`Create userdata json file failed: ${error.message}`);
    }

    const vscodeFolderPath =
        path.join(deviceFolderPath, FileNames.vscodeSettingsFolderName);
    if (!fs.existsSync(vscodeFolderPath)) {
      fs.mkdirSync(vscodeFolderPath);
    }

    // Create settings.json config file
    const settingsJSONFilePath =
        path.join(vscodeFolderPath, FileNames.settingsJsonFileName);
    const settingsJSONObj = {
      'files.exclude': {'.build': true, '.iotworkbenchproject': true}
    };

    try {
      fs.writeFileSync(
          settingsJSONFilePath, JSON.stringify(settingsJSONObj, null, 4));
    } catch (error) {
      throw new Error(`Device: create config file failed: ${error.message}`);
    }

    return true;
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
    // TODO: try to connect to access point host of IoT button to detect the
    // connection.
    const configSelectionItems: vscode.QuickPickItem[] = [
      {
        label: 'Config WiFi of Azure IoT Button',
        description: 'Config WiFi of Azure IoT Button',
        detail: 'Config WiFi'
      },
      {
        label: 'Config connection of IoT Hub Device',
        description: 'Config connection of IoT Hub Device',
        detail: 'Config IoT Hub Device'
      },
      {
        label: 'Config JSON data to append to message',
        description: 'Config JSON data to append to message',
        detail: 'Config User Json Data'
      }
    ];

    const configSelection =
        await vscode.window.showQuickPick(configSelectionItems, {
          ignoreFocusOut: true,
          matchOnDescription: true,
          matchOnDetail: true,
          placeHolder: 'Select an option',
        });
    if (!configSelection) {
      return false;
    }

    return true;
  }
}