// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import {ArduinoPackageManager} from './ArduinoPackageManager';
import {BoardProvider} from './boardProvider';
import {ConfigHandler} from './configHandler';
import {ConfigKey, ContentView, EventNames} from './constants';
import {callWithTelemetry, TelemetryContext, TelemetryWorker} from './telemetry';

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

  constructor(
      private context: vscode.ExtensionContext,
      private channel: vscode.OutputChannel) {}

  getBoardFromDeviceInfo(device: DeviceInfo) {
    if (device.vendorId && device.productId) {
      const boardProvider = new BoardProvider(this.context);
      const board = boardProvider.find(
          {vendorId: device.vendorId, productId: device.productId});

      return board;
    }
    return undefined;
  }

  showLandingPage(device: DeviceInfo) {
    // if current workspace is iot workbench workspace
    // we shouldn't popup landing page
    // if (vscode.workspace.workspaceFolders &&
    //     vscode.workspace.workspaceFolders.length) {
    //   const devicePath = ConfigHandler.get<string>(ConfigKey.devicePath);
    //   if (devicePath) {
    //     const deviceLocation = path.join(
    //         vscode.workspace.workspaceFolders[0].uri.fsPath, '..',
    //         devicePath, constants.iotworkbenchprojectFileName);
    //     if (fs.existsSync(deviceLocation)) {
    //       return;
    //     }
    //   }
    // }

    const board = this.getBoardFromDeviceInfo(device);

    if (board) {
      callWithTelemetry(
          EventNames.detectBoard, this.channel, false, this.context, () => {
            if (board.exampleUrl) {
              ArduinoPackageManager.installBoard(board);
              vscode.commands.executeCommand(
                  'vscode.previewHtml',
                  ContentView.workbenchExampleURI + '?' +
                      encodeURIComponent(
                          'board=' + board.id +
                          '&url=' + encodeURIComponent(board.exampleUrl || '')),
                  vscode.ViewColumn.One, 'IoT Workbench Examples');
            }
          }, {board: board.name});
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
      devices.forEach(this.showLandingPage.bind(this));
    }

    UsbDetector._usbDetector.on('add', this.showLandingPage.bind(this));
  }
}