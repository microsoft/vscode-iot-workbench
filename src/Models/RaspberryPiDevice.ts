// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as cp from 'child_process';
import * as fs from 'fs-plus';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, FileNames} from '../constants';
import {ProjectTemplate, ProjectTemplateType} from '../Models/Interfaces/ProjectTemplate';
import {IoTProject} from '../Models/IoTProject';
import {SSH} from '../Models/SSH';

import {Component, ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';

const constants = {
  defaultSketchFileName: 'app.js'
};


export class RaspberryPiDevice implements Device {
  private deviceType: DeviceType;
  private componentType: ComponentType;
  private deviceFolder: string;
  private extensionContext: vscode.ExtensionContext;
  private channel: vscode.OutputChannel;
  private sketchName = '';
  private static _boardId = 'raspberrypi';

  static get boardId() {
    return RaspberryPiDevice._boardId;
  }

  constructor(
      context: vscode.ExtensionContext, devicePath: string,
      channel: vscode.OutputChannel, sketchName?: string) {
    this.deviceType = DeviceType.Raspberry_Pi;
    this.componentType = ComponentType.Device;
    this.deviceFolder = devicePath;
    this.extensionContext = context;
    this.channel = channel;
    if (sketchName) {
      this.sketchName = sketchName;
    }
  }

  name = 'RaspberryPi';

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
            FileNames.resourcesFolderName, RaspberryPiDevice.boardId,
            this.sketchName));
    const newSketchFilePath = path.join(deviceFolderPath, sketchFileName);

    try {
      const content = fs.readFileSync(sketchTemplateFilePath).toString();
      fs.writeFileSync(newSketchFilePath, content);
    } catch (error) {
      throw new Error(`Create ${sketchFileName} failed: ${error.message}`);
    }

    const packageTemplateFilePath =
        this.extensionContext.asAbsolutePath(path.join(
            FileNames.resourcesFolderName, RaspberryPiDevice.boardId,
            'package.json'));
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

  async compile(): Promise<boolean> {
    await vscode.window.showInformationMessage(
        'Compiling device code for Raspberry Pi is not supported');
    return true;
  }

  async upload(): Promise<boolean> {
    // Raspberry Pi host
    const raspiHostOption: vscode.InputBoxOptions = {
      value: 'raspberrypi',
      prompt: `Please input Raspberry Pi ip or hostname here.`,
      ignoreFocusOut: true
    };
    let raspiHost = await vscode.window.showInputBox(raspiHostOption);
    if (raspiHost === undefined) {
      return false;
    }
    raspiHost = raspiHost || 'raspberrypi';

    // Raspberry Pi SSH port
    const raspiPortOption: vscode.InputBoxOptions = {
      value: '22',
      prompt: `Please input Raspberry Pi SSH port here.`,
      ignoreFocusOut: true
    };
    const raspiPortString = await vscode.window.showInputBox(raspiPortOption);
    if (raspiPortString === undefined) {
      return false;
    }
    const raspiPort = raspiPortString && !isNaN(Number(raspiPortString)) ?
        Number(raspiPortString) :
        22;

    // Raspberry Pi user name
    const raspiUserOption: vscode.InputBoxOptions = {
      value: 'pi',
      prompt: `Please input Raspberry Pi user name here.`,
      ignoreFocusOut: true
    };
    let raspiUser = await vscode.window.showInputBox(raspiUserOption);
    if (raspiUser === undefined) {
      return false;
    }
    raspiUser = raspiUser || 'pi';

    // Raspberry Pi user password
    const raspiPasswordOption: vscode.InputBoxOptions = {
      value: 'raspberry',
      prompt: `Please input Raspberry Pi password here.`,
      ignoreFocusOut: true
    };
    let raspiPassword = await vscode.window.showInputBox(raspiPasswordOption);
    if (raspiPassword === undefined) {
      return false;
    }
    raspiPassword = raspiPassword || 'raspberry';

    // Raspberry Pi path
    const raspiPathOption: vscode.InputBoxOptions = {
      value: 'IoTProject',
      prompt: `Please input Raspberry Pi path here.`,
      ignoreFocusOut: true
    };
    let raspiPath = await vscode.window.showInputBox(raspiPathOption);
    if (raspiPath === undefined) {
      return false;
    }
    raspiPath = raspiPath || 'IoTProject';

    const ssh = new SSH(this.channel);

    const sshConnected =
        await ssh.connect(raspiHost, raspiPort, raspiUser, raspiPassword);
    let sshUploaded: boolean;
    if (sshConnected) {
      sshUploaded = await ssh.upload(this.deviceFolder, raspiPath as string);
    } else {
      await ssh.close();
      return false;
    }

    let sshNpmInstalled: boolean;
    if (sshUploaded) {
      sshNpmInstalled = await ssh.shell(`cd ${raspiPath} && npm install`);
    } else {
      await ssh.close();
      return false;
    }

    await ssh.close();
    return true;
  }

  async configDeviceSettings(): Promise<boolean> {
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