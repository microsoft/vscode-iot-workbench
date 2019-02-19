// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import {Guid} from 'guid-typescript';
import * as path from 'path';
import * as request from 'request-promise';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, FileNames} from '../constants';
import {OperatingResultType, OperatingResult} from '../OperatingResult';

import {ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';

const constants = {
  timeout: 10000,
  accessEndpoint: 'http://192.168.4.1',
  userjsonFilename: 'userdata.json'
};


export class IoTButtonDevice implements Device {
  private deviceType: DeviceType;
  private componentType: ComponentType;
  private deviceFolder: string;
  private extensionContext: vscode.ExtensionContext;
  private inputFileName = '';

  private componentId: string;
  get id() {
    return this.componentId;
  }

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
    this.componentId = Guid.create().toString();
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

  async checkPrerequisites(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('IoTButtonDeviceCheckPrerequisites', OperatingResultType.Succeeded);
    return operatingResult;
  }

  async load(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('IoTButtonDeviceLoad');
    const deviceFolderPath = this.deviceFolder;

    if (!fs.existsSync(deviceFolderPath)) {
      operatingResult.update(OperatingResultType.Failed, 'Unable to find the device folder inside the project.');
    } else {
      operatingResult.update(OperatingResultType.Succeeded);
    }
    return operatingResult;
  }

  async create(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('IoTButtonDeviceCreate');
    if (!this.inputFileName) {
      operatingResult.update(OperatingResultType.Failed, 'No user data file found.');
      return operatingResult;
    }
    const deviceFolderPath = this.deviceFolder;

    if (!fs.existsSync(deviceFolderPath)) {
      operatingResult.update(OperatingResultType.Failed, 'Unable to find the device folder inside the project.');
      return operatingResult;
    }

    try {
      const iotworkbenchprojectFilePath =
          path.join(deviceFolderPath, FileNames.iotworkbenchprojectFileName);
      fs.writeFileSync(iotworkbenchprojectFilePath, ' ');
    } catch (error) {
      operatingResult.update(OperatingResultType.Failed, '[ERROR] Device: create iotworkbenchproject file failed: ' + error.message);
      return operatingResult;
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
      operatingResult.update(OperatingResultType.Failed, '[ERROR] Create userdata JSON file failed: ' + error.message);
      return operatingResult;
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
      operatingResult.update(OperatingResultType.Failed, '[ERROR] Device: create config file failed: ' + error.message);
      return operatingResult;
    }

    operatingResult.update(OperatingResultType.Succeeded);
    return operatingResult;
  }

  async compile(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('IoTButtonDeviceCompile', OperatingResultType.Succeeded, 'Congratulations! There is no device code to compile in this project.');
    return operatingResult;
  }

  async upload(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('IoTButtonDeviceUpload', OperatingResultType.Succeeded, 'Congratulations! There is no device code to upload in this project.');
    return operatingResult;
  }

  async configDeviceSettings(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('IoTButtonConfigDeviceSettings');
    // TODO: try to connect to access point host of IoT button to detect the
    // connection.
    const configSelectionItems: vscode.QuickPickItem[] = [
      {
        label: 'Config WiFi of IoT button',
        description: 'Config WiFi of IoT button',
        detail: 'Config WiFi'
      },
      {
        label: 'Config connection of IoT Hub Device',
        description: 'Config connection of IoT Hub Device',
        detail: 'Config IoT Hub Device'
      },
      {
        label: 'Config time server of IoT button',
        description: 'Config time server of IoT button',
        detail: 'Config Time Server'
      },
      {
        label: 'Config JSON data to append to message',
        description: 'Config JSON data to append to message',
        detail: 'Config User Json Data'
      },
      {
        label: 'Shutdown IoT button',
        description: 'Shutdown IoT button',
        detail: 'Shutdown'
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
      operatingResult.update(OperatingResultType.Canceled);
      return operatingResult;
    }

    if (configSelection.detail === 'Config WiFi') {
      const configWifiResult = new OperatingResult('IoTButtonDeviceConfigWiFi');
      try {
        const res = await this.configWifi();
        configWifiResult.append(res);
      } catch (error) {
        configWifiResult.update(OperatingResultType.Failed, '[ERROR] Config WiFi failed: ' + error.message);
      }
      return configWifiResult;
    } else if (configSelection.detail === 'Config IoT Hub Device') {
      const configConnectionStringResult = new OperatingResult('IoTButtonDeviceConnectionString');
      try {
        const res = await this.configHub();
        if (res) {
          configConnectionStringResult.update(OperatingResultType.Succeeded);
        } else {
          configConnectionStringResult.update(OperatingResultType.Failed);
        }
      } catch (error) {
        configConnectionStringResult.update(OperatingResultType.Failed, '[ERROR] Config IoT Hub failed: ' + error.message);
      }

      return configConnectionStringResult;
    } else if (configSelection.detail === 'Config Time Server') {
      const configTimeServerResult = new OperatingResult('IoTButtonDeviceConfigTimeServer');
      try {
        const res = await this.configNtp();
        configTimeServerResult.append(res);
      } catch (error) {
        configTimeServerResult.update(OperatingResultType.Failed, '[ERROR] Config Time Server failed: ' + error.message);
      }
      return configTimeServerResult;
    } else if (configSelection.detail === 'Config User Json Data') {
      const configUserDataResult = new OperatingResult('IoTButtonDeviceConfiguserData');
      try {
        const res = await this.configUserData();
        configUserDataResult.append(res);
      } catch (error) {
        configUserDataResult.update(OperatingResultType.Failed, '[ERROR] Config user data failed: ' + error.message);
      }

      return configUserDataResult;
    } else {
      const saveAndShutdownResult = new OperatingResult('IoTButtonDeviceSaveAndShutdown', OperatingResultType.Succeeded);
      try {
        const res = await this.configSaveAndShutdown();
      } catch (error) {
        // Ignore.
        // Because the button has been shutdown, we won't get any response for
        // the action
      }

      return saveAndShutdownResult;
    }
  }

  async setConfig(uri: string, data: {}): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('IoTButtonDeviceSetConfig');
    const option =
        {uri, method: 'POST', timeout: constants.timeout, form: data};

    const res = await request(option);

    if (!res) {
      operatingResult.update(OperatingResultType.Failed, 'Empty response.');
    } else {
      operatingResult.update(OperatingResultType.Succeeded);
    }

    return operatingResult;
  }

  async configWifi(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('IoTHubDeviceConfigWifi');
    const ssid = await vscode.window.showInputBox({
      prompt: `WiFi SSID`,
      ignoreFocusOut: true,
      validateInput: (ssid: string) => {
        if (!ssid) {
          return 'WiFi SSID cannot be empty.';
        } else {
          return;
        }
      }
    });

    if (ssid === undefined) {
      operatingResult.update(OperatingResultType.Canceled, 'Canceled to select WiFi.');
      return operatingResult;
    }

    const password = await vscode.window.showInputBox(
        {prompt: `WiFi Password`, password: true, ignoreFocusOut: true});

    if (password === undefined) {
      operatingResult.update(OperatingResultType.Canceled, 'Canceled to input WiFi password.');
      return operatingResult;
    }

    const data = {ssid, password};
    const uri = constants.accessEndpoint;

    const res = await this.setConfig(uri, data);
    operatingResult.append(res);
    return operatingResult;
  }

  async configHub(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('IoTButtonDeviceConfigHub');
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
      operatingResult.update(OperatingResultType.Canceled);
      return operatingResult;
    }

    if (selection.detail === 'Input another...') {
      const option: vscode.InputBoxOptions = {
        value:
            'HostName=<Host Name>;DeviceId=<Device Name>;SharedAccessKey=<Device Key>',
        prompt: `Please input device connection string here.`,
        ignoreFocusOut: true,
        validateInput: (connectionString: string) => {
          if (!connectionString) {
            return 'Connection string cannot be empty.';
          } else {
            return;
          }
        }
      };

      deviceConnectionString = await vscode.window.showInputBox(option);
      if (deviceConnectionString === undefined) {
        operatingResult.update(OperatingResultType.Canceled);
        return operatingResult;
      }

      if ((deviceConnectionString.indexOf('HostName') === -1) ||
          (deviceConnectionString.indexOf('DeviceId') === -1) ||
          (deviceConnectionString.indexOf('SharedAccessKey') === -1)) {
        operatingResult.update(OperatingResultType.Failed, 'The format of the IoT Hub Device connection string is invalid. Please provide a valid Device connection string.');
        return operatingResult;
      }
    }

    if (!deviceConnectionString) {
      operatingResult.update(OperatingResultType.Canceled);
      return operatingResult;
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
      operatingResult.update(OperatingResultType.Failed, 'Cannot find host name, device ID or shared access key from connection string.');
      return operatingResult;
    }

    const iothub = iothubMatches[1];
    const iotdevicename = iotdevicenameMatches[1];
    const iotdevicesecret = iotdevicesecretMatches[1];

    const data = {iothub, iotdevicename, iotdevicesecret};
    const uri = constants.accessEndpoint;

    const res = await this.setConfig(uri, data);
    operatingResult.append(res);
    return operatingResult;
  }

  async configUserData(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('IoTButtonDeviceConfigUserData');
    const deviceFolderPath = this.deviceFolder;

    if (!fs.existsSync(deviceFolderPath)) {
      operatingResult.update(OperatingResultType.Failed, 'Unable to find the device folder inside the project.');
      return operatingResult;
    }

    const userjsonFilePath =
        path.join(deviceFolderPath, constants.userjsonFilename);

    if (!fs.existsSync(userjsonFilePath)) {
      operatingResult.update(OperatingResultType.Failed, 'The user json file does not exist.');
      return operatingResult;
    }

    let userjson = {};

    try {
      userjson = JSON.parse(fs.readFileSync(userjsonFilePath, 'utf8'));
    } catch (error) {
      userjson = {};
    }

    const data = {userjson: JSON.stringify(userjson)};
    const uri = constants.accessEndpoint;

    const res = await this.setConfig(uri, data);
    operatingResult.append(res);
    return operatingResult;
  }

  async configNtp(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('IoTButtonDeviceConfigNTP');
    const timeserver = await vscode.window.showInputBox({
      value: 'pool.ntp.org',
      prompt: `Time Server`,
      ignoreFocusOut: true,
      validateInput: (timeserver: string) => {
        if (!timeserver) {
          return 'Time Server cannot be empty.';
        } else {
          return;
        }
      }
    });

    if (timeserver === undefined) {
      operatingResult.update(OperatingResultType.Canceled);
      return operatingResult;
    }

    const data = {timeserver};
    const uri = constants.accessEndpoint;

    const res = await this.setConfig(uri, data);
    operatingResult.append(res);
    return operatingResult;
  }

  async configSaveAndShutdown(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('IoTButtonDeviceConfigSaveAndShutdown');
    const data = {action: 'shutdown'};
    const uri = constants.accessEndpoint;

    const res = await this.setConfig(uri, data);
    operatingResult.append(res);
    return operatingResult;
  }
}