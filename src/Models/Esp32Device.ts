// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as copypaste from 'copy-paste';
import * as fs from 'fs-plus';
import {Guid} from 'guid-typescript';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import {BoardProvider} from '../boardProvider';
import {ConfigHandler} from '../configHandler';
import {ConfigKey} from '../constants';
import {OperatingResultType, OperatingResult} from '../OperatingResult';


import {ArduinoDeviceBase} from './ArduinoDeviceBase';
import {DeviceType} from './Interfaces/Device';

const constants = {
  defaultBoardInfo: 'esp32:esp32:m5stack-core-esp32',
  defaultBoardConfig:
      'FlashMode=qio,FlashFreq=80,UploadSpeed=921600,DebugLevel=none'
};

export class Esp32Device extends ArduinoDeviceBase {
  private sketchFileTemplateName = '';
  private static _boardId = 'esp32';
  private channel: vscode.OutputChannel;

  private componentId: string;
  get id() {
    return this.componentId;
  }

  static get boardId() {
    return Esp32Device._boardId;
  }

  get board() {
    const boardProvider = new BoardProvider(this.extensionContext);
    const esp32 = boardProvider.find({id: Esp32Device._boardId});
    return esp32;
  }

  get version() {
    const plat = os.platform();
    let packageRootPath = '';
    let version = '0.0.1';

    if (plat === 'win32') {
      const homeDir = os.homedir();
      const localAppData: string = path.join(homeDir, 'AppData', 'Local');
      packageRootPath = path.join(
          localAppData, 'Arduino15', 'packages', 'esp32', 'hardware', 'esp32');
    } else {
      packageRootPath = '~/Library/Arduino15/packages/esp32/hardware/esp32';
    }

    if (fs.existsSync(packageRootPath)) {
      const versions = fs.readdirSync(packageRootPath);
      if (versions[0]) {
        version = versions[0];
      }
    }

    return version;
  }

  name = 'Esp32Arduino';

  constructor(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      devicePath: string, sketchFileTemplateName?: string) {
    super(context, devicePath, DeviceType.IoT_Button);
    this.channel = channel;
    this.componentId = Guid.create().toString();
    if (sketchFileTemplateName) {
      this.sketchFileTemplateName = sketchFileTemplateName;
    }
  }

  async checkPrerequisites(): Promise<OperatingResult> {
    return super.checkPrerequisites();
  }

  async load(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('Esp32DeviceLoad');
    const deviceFolderPath = this.deviceFolder;

    if (!fs.existsSync(deviceFolderPath)) {
      operatingResult.update(OperatingResultType.Failed, 'Unable to find the device folder inside the project.');
      return operatingResult;
    }

    if (!this.board) {
      operatingResult.update(OperatingResultType.Failed, 'Unable to find the board in the config file.');
      return operatingResult;
    }

    this.generateCppPropertiesFile(this.board);

    operatingResult.update(OperatingResultType.Succeeded);
    return operatingResult;
  }

  async create(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('Esp32DeviceCreate');

    if (!this.sketchFileTemplateName) {
      operatingResult.update(OperatingResultType.Failed, 'No sketch file found.');
      return operatingResult;
    }
    const deviceFolderPath = this.deviceFolder;

    if (!fs.existsSync(deviceFolderPath)) {
      operatingResult.update(OperatingResultType.Failed, 'Unable to find the device folder inside the project.');
      return operatingResult;
    }
    if (!this.board) {
      operatingResult.update(OperatingResultType.Failed, 'Unable to find the board in the config file.');
      return operatingResult;
    }

    this.generateCommonFiles();
    this.generateCppPropertiesFile(this.board);
    await this.generateSketchFile(
        this.sketchFileTemplateName, this.board, constants.defaultBoardInfo,
        constants.defaultBoardConfig);

    operatingResult.update(OperatingResultType.Succeeded);
    return operatingResult;
  }


  async configDeviceSettings(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('Esp32DeviceConfigDeviceSettings');

    const configSelectionItems: vscode.QuickPickItem[] = [
      {
        label: 'Copy device connection string',
        description: 'Copy device connection string',
        detail: 'Copy'
      },
      {
        label: 'Generate CRC for OTA',
        description:
            'Generate Cyclic Redundancy Check(CRC) code for OTA Update',
        detail: 'Config CRC'
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

    if (configSelection.detail === 'Config CRC') {
      const configCrcResult = new OperatingResult('Esp32DeviceConfigCRC');
      const retValue: boolean =
          await this.generateCrc(this.extensionContext, this.channel);
      if (retValue) {
        configCrcResult.update(OperatingResultType.Succeeded);
      } else {
        configCrcResult.update(OperatingResultType.Failed);
      }

      return configCrcResult;
    } else {
      const copyConnectionStringResult = new OperatingResult('Esp32CopyConnectionString');
      const deviceConnectionString =
          ConfigHandler.get<string>(ConfigKey.iotHubDeviceConnectionString);

      if (!deviceConnectionString) {
        copyConnectionStringResult.update(OperatingResultType.Failed, 'Unable to get the device connection string, please invoke the command of Azure Provision first.');
        return copyConnectionStringResult;
      }
      copypaste.copy(deviceConnectionString);

      copyConnectionStringResult.update(OperatingResultType.Succeeded);
      return copyConnectionStringResult;
    }
  }

  async preCompileAction(): Promise<OperatingResult> {
    const preCompileActionResult = new OperatingResult('Esp32DevicePreCompileAction', OperatingResultType.Succeeded);
    return preCompileActionResult;
  }

  async preUploadAction(): Promise<OperatingResult> {
    const preUploadActionResult = new OperatingResult('Esp32DevicePreUploadAction', OperatingResultType.Succeeded);
    return preUploadActionResult;
  }
}
