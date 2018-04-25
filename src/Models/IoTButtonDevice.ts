// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as os from 'os';
import * as path from 'path';
import * as request from 'request-promise';
import {error} from 'util';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, FileNames} from '../constants';
import {ProjectTemplate, ProjectTemplateType} from '../Models/Interfaces/ProjectTemplate';
import {IoTProject} from '../Models/IoTProject';

import {Component, ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';

const constants = {
  timeout: 10000,
  accessPointHost: 'http://192.168.4.1',
  wifiPath: '/config/wifi',
  hubPath: '/config/iothub',
  userjsonPath: '/config/userjson',
  userjsonFilename: 'userdata.json',
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

    if (configSelection.detail === 'Config WiFi') {
      const res = await this.configWifi();
      // console.log(res);
    } else if (configSelection.detail === 'Config IoT Hub Device') {
      const res = await this.configHub();
      // console.log(res);
    } else {
      const res = await this.configUserData();
      // console.log(res);
    }

    return true;
  }

  async setConfig(uri: string, json: {}) {
    const option = {
      uri,
      method: 'POST',
      timeout: constants.timeout,
      headers: constants.requestHead,
      json
    };

    const res = await request(option);

    return res;
  }

  async configWifi() {
    const ssid = await vscode.window.showInputBox({
      prompt: `WiFi SSID`,
      ignoreFocusOut: true,
    });

    if (!ssid) {
      return false;
    }

    const password = await vscode.window.showInputBox({
      prompt: `WiFi Password`,
      ignoreFocusOut: true,
    });

    if (!password) {
      return false;
    }

    const data = {ssid, password};
    const uri = constants.accessPointHost + constants.wifiPath;

    const res = await this.setConfig(uri, data);

    return res;
  }

  async configHub() {
    let deviceConnectionString =
        ConfigHandler.get<string>(ConfigKey.iotHubDeviceConnectionString);

    let hostName = '';
    let deviceId = '';
    if (deviceConnectionString) {
      const hostnameMatches =
          deviceConnectionString.match(/HostName=(.*?)(;|$)/);
      if (hostnameMatches) {
        hostName = hostnameMatches[0];
      }

      const deviceIDMatches =
          deviceConnectionString.match(/DeviceId=(.*?)(;|$)/);
      if (deviceIDMatches) {
        deviceId = deviceIDMatches[0];
      }
    }

    let deviceConnectionStringSelection: vscode.QuickPickItem[] = [];
    if (deviceId && hostName) {
      deviceConnectionStringSelection = [
        {
          label: 'Select IoT Hub Device Connection String',
          description: '',
          detail: `Device Information: ${hostName} ${deviceId}`
        },
        {
          label: 'Input IoT Hub Device Connection String',
          description: '',
          detail: 'Input another...'
        }
      ];
    } else {
      deviceConnectionStringSelection = [{
        label: 'Input IoT Hub Device Connection String',
        description: '',
        detail: 'Input another...'
      }];
    }

    const selection =
        await vscode.window.showQuickPick(deviceConnectionStringSelection, {
          ignoreFocusOut: true,
          placeHolder: 'Choose IoT Hub Device Connection String'
        });

    if (!selection) {
      return false;
    }

    if (selection.detail === 'Input another...') {
      const option: vscode.InputBoxOptions = {
        value:
            'HostName=<Host Name>;DeviceId=<Device Name>;SharedAccessKey=<Device Key>',
        prompt: `Please input device connection string here.`,
        ignoreFocusOut: true
      };

      deviceConnectionString = await vscode.window.showInputBox(option);
      if (!deviceConnectionString) {
        return false;
      }
      if ((deviceConnectionString.indexOf('HostName') === -1) ||
          (deviceConnectionString.indexOf('DeviceId') === -1) ||
          (deviceConnectionString.indexOf('SharedAccessKey') === -1)) {
        throw new Error(
            'The format of the IoT Hub Device connection string is invalid. Please provide a valid Device connection string.');
      }
    }

    if (!deviceConnectionString) {
      return false;
    }

    console.log(deviceConnectionString);

    const iothubMatches = deviceConnectionString.match(/HostName=(.*?)(;|$)/);
    const iotdevicenameMatches =
        deviceConnectionString.match(/DeviceId=(.*?)(;|$)/);
    const iotdevicesecretMatches =
        deviceConnectionString.match(/SharedAccessKey=(.*?)(;|$)/);
    if (!iothubMatches || !iothubMatches[1] || !iotdevicenameMatches ||
        !iotdevicenameMatches[1] || !iotdevicesecretMatches ||
        !iotdevicesecretMatches[1]) {
      return false;
    }

    const iothub = iothubMatches[1];
    const iotdevicename = iotdevicenameMatches[1];
    const iotdevicesecret = iotdevicesecretMatches[1];

    const data = {iothub, iotdevicename, iotdevicesecret};
    const uri = constants.accessPointHost + constants.hubPath;

    const res = await this.setConfig(uri, data);

    return res;
  }

  async configUserData() {
    const deviceFolderPath = this.deviceFolder;

    if (!fs.existsSync(deviceFolderPath)) {
      throw new Error(`Device folder doesn't exist: ${deviceFolderPath}`);
    }

    const userjsonFilePath =
        path.join(deviceFolderPath, constants.userjsonFilename);

    if (!fs.existsSync(userjsonFilePath)) {
      throw new Error(`${userjsonFilePath} does not exist.`);
    }

    let userjson = {};

    try {
      userjson = require(userjsonFilePath);
    } catch (error) {
      userjson = {};
    }

    const data = {userjson};
    const uri = constants.accessPointHost + constants.userjsonPath;

    const res = await this.setConfig(uri, data);

    return res;
  }
}