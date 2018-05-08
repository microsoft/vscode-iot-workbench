// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import {ArduinoPackageManager} from './ArduinoPackageManager';
import {BoardProvider} from './boardProvider';
import {ConfigHandler} from './configHandler';
import {ConfigKey, ContentView} from './constants';

export interface DeviceInfo {
  vendorId: number;
  productId: number;
}

const constants = {
  iotworkbenchprojectFileName: '.iotworkbenchproject'
};

export class UsbDetector {
  // tslint:disable-next-line: no-any
  private static _usbDetector: any =
      require('../../vendor/node-usb-native').detector;

  constructor(private context: vscode.ExtensionContext) {}

  showLandingPage(device: DeviceInfo) {
    // if current workspace is iot workbench workspace
    // we shouldn't popup landing page
    if (vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length) {
      const devicePath = ConfigHandler.get<string>(ConfigKey.devicePath);
      if (devicePath) {
        const deviceLocation = path.join(
            vscode.workspace.workspaceFolders[0].uri.fsPath, '..', devicePath,
            constants.iotworkbenchprojectFileName);
        if (fs.existsSync(deviceLocation)) {
          return;
        }
      }
    }

    if (device.vendorId && device.productId) {
      const boardProvider = new BoardProvider(this.context);
      const board = boardProvider.find(
          {vendorId: device.vendorId, productId: device.productId});

      if (board) {
        ArduinoPackageManager.installBoard(board);
        vscode.commands.executeCommand(
            'vscode.previewHtml',
            ContentView.workbenchExampleURI + '?' + board.id,
            vscode.ViewColumn.One, 'IoT Workbench Examples');
      }
    }
  }

  async startListening() {
    const disableUSBDetection =
        ConfigHandler.get<boolean>('disableAutoPopupLandingPage');
    if (os.platform() === 'linux' || disableUSBDetection) {
      return;
    }

    if (!UsbDetector._usbDetector) {
      return;
    }

    const devices: DeviceInfo[]|undefined =
        await UsbDetector._usbDetector.find();
    if (devices) {
      devices.forEach(this.showLandingPage);
    }

    UsbDetector._usbDetector.on('add', this.showLandingPage);
  }
}