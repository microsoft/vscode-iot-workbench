// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as cp from 'child_process';
import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, FileNames} from '../constants';
import {ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';

const constants = {
  defaultSketchFileName: 'app.js'
};

export async function simulatorRun() {
  if (vscode.workspace.rootPath === undefined) {
    throw new Error('Unable to find the path');
  }
  if (!vscode.workspace.workspaceFolders) {
    throw new Error(
        'Unable to find the root path, please open an IoT Workbench project');
  }
  const currentPath = vscode.workspace.rootPath;

  if (fs.existsSync(path.join(currentPath, 'config.json')) === false) {
    throw new Error('Connection String not set!');
  }
  const packageObj = require(path.join(currentPath, 'package.json'));
  const execFileName = packageObj.main;
  console.log('Installing Dependencies');
  await cp.execSync('npm install', {cwd: currentPath});
  console.log('Dependencies Installed');
  console.log('Starting Simulating');
  const child = cp.execFile('node', [`${execFileName}`], {cwd: currentPath});
  child.stdout.on('data', (data) => {
    console.log(data.toString());
  });
  return true;
}

export class Simulator implements Device {
  private deviceType: DeviceType;
  private componentType: ComponentType;
  private deviceFolder: string;
  private extensionContext: vscode.ExtensionContext;
  private channel: vscode.OutputChannel;
  private sketchName = '';
  private static _boardId = 'simulator';
  name = 'Simulator';
  constructor(
      context: vscode.ExtensionContext, devicePath: string,
      channel: vscode.OutputChannel, sketchName?: string) {
    this.deviceType = DeviceType.Simulator;
    this.componentType = ComponentType.Device;
    this.deviceFolder = devicePath;
    this.extensionContext = context;
    this.channel = channel;
    if (sketchName) {
      this.sketchName = sketchName;
    }
  }
  static get boardId() {
    return Simulator._boardId;
  }
  getDeviceType(): DeviceType {
    return this.deviceType;
  }
  getComponentType(): ComponentType {
    return this.componentType;
  }
  async compile(): Promise<boolean> {
    await vscode.window.showInformationMessage(
        'Compiling device code for Simualtor is not supported');
    return true;
  }
  async upload(): Promise<boolean> {
    await vscode.window.showInformationMessage(
        'Upload device code for Simulator is not supported');
    return true;
  }
  async load(): Promise<boolean> {
    const deviceFolderPath = this.deviceFolder;

    if (!fs.existsSync(deviceFolderPath)) {
      throw new Error('Unable to find the device folder inside the project.');
    }

    if (!fs.existsSync(path.join(deviceFolderPath, 'node_modules'))) {
      cp.exec('npm install', {cwd: deviceFolderPath});
    }
    return true;
  }

  async create(): Promise<boolean> {
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

    const vscodeFolderPath =
        path.join(deviceFolderPath, FileNames.vscodeSettingsFolderName);
    if (!fs.existsSync(vscodeFolderPath)) {
      fs.mkdirSync(vscodeFolderPath);
    }

    const option: vscode.InputBoxOptions = {
      value: constants.defaultSketchFileName,
      prompt: `Please input device sketch file name here.`,
      ignoreFocusOut: true,
      validateInput: (sketchFileName: string) => {
        if (!sketchFileName ||
            /^([a-z_]|[a-z_][-a-z0-9_.]*[a-z0-9_])(\.js)?$/i.test(
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
      if (!/\.js$/i.test(sketchFileName)) {
        sketchFileName += '.js';
      }
    }

    const sketchTemplateFilePath =
        this.extensionContext.asAbsolutePath(path.join(
            FileNames.resourcesFolderName, Simulator.boardId, this.sketchName));
    const newSketchFilePath = path.join(deviceFolderPath, sketchFileName);

    try {
      const content = fs.readFileSync(sketchTemplateFilePath).toString();
      fs.writeFileSync(newSketchFilePath, content);
    } catch (error) {
      throw new Error(`Create ${sketchFileName} failed: ${error.message}`);
    }

    const packageTemplateFilePath =
        this.extensionContext.asAbsolutePath(path.join(
            FileNames.resourcesFolderName, Simulator.boardId, 'package.json'));
    const newPackageFilePath = path.join(deviceFolderPath, 'package.json');

    try {
      const packageObj = require(packageTemplateFilePath);
      packageObj.main = sketchFileName;
      fs.writeFileSync(newPackageFilePath, JSON.stringify(packageObj, null, 2));
    } catch (error) {
      throw new Error(`Create package.json failed: ${error.message}`);
    }

    const settingsJSONFilePath =
        path.join(vscodeFolderPath, FileNames.settingsJsonFileName);
    const settingsJSONObj = {'files.exclude': {'.iotworkbenchproject': true}};

    try {
      fs.writeFileSync(
          settingsJSONFilePath, JSON.stringify(settingsJSONObj, null, 4));
    } catch (error) {
      throw new Error(`Device: create config file failed: ${error.message}`);
    }

    cp.exec('npm install', {cwd: deviceFolderPath});

    return true;
  }
  async configDeviceSettings(): Promise<boolean> {
    try {
      const res = await this.configHub();
      return res;
    } catch (error) {
      vscode.window.showWarningMessage('Config IoT Hub failed.');
      return false;
    }
  }


  async configHub(): Promise<boolean> {
    try {
      const deviceFolderPath = this.deviceFolder;

      if (!fs.existsSync(deviceFolderPath)) {
        throw new Error('Unable to find the device folder inside the project.');
      }

      // Get IoT Hub device connection string from config
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

      // Set selected connection string to device
      try {
        const configFilePath = path.join(deviceFolderPath, 'config.json');
        const config = {connectionString: deviceConnectionString};
        fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
      } catch (error) {
        throw new Error(`Device: create config file failed: ${error.message}`);
      }

      vscode.window.showInformationMessage(
          'Configure Device connection string successfully.');
      return true;
    } catch (error) {
      throw error;
    }
  }
}