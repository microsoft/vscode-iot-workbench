// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as os from 'os';
import * as vscode from 'vscode';
import {VSCExpress} from 'vscode-express';

import {ArduinoPackageManager} from './ArduinoPackageManager';
import {BoardProvider} from './boardProvider';
import {ConfigHandler} from './configHandler';
import {EventNames} from './constants';
import {callWithTelemetry} from './telemetry';

export interface DeviceInfo {
  vendorId: number;
  productId: number;
}

export class UsbDetector {
  private static _vscexpress: VSCExpress|undefined;
  // tslint:disable-next-line: no-any
  private static _usbDetector: any =
      require('../vendor/node-usb-native').detector;

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
    // if current workspace is iot device workbench workspace
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
          EventNames.detectBoard, this.channel, false,
          this.context, async () => {
            if (board.exampleUrl) {
              ArduinoPackageManager.installBoard(board);

              const exampleUrl = 'example.html?board=' + board.id +
                  '&url=' + encodeURIComponent(board.exampleUrl || '');
              UsbDetector._vscexpress = UsbDetector._vscexpress ||
                  new VSCExpress(this.context, 'views');
              UsbDetector._vscexpress.open(
                  exampleUrl, 'Examples - Azure IoT Device Workbench',
                  vscode.ViewColumn.One, {
                    enableScripts: true,
                    enableCommandUris: true,
                    retainContextWhenHidden: true
                  });
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
      const uniqueDevices: DeviceInfo[] = [];

      devices.forEach(device => {
        if (uniqueDevices.findIndex(
                item => item.vendorId === device.vendorId &&
                    item.productId === device.productId) < 0) {
          uniqueDevices.push(device);
        }
      });

      uniqueDevices.forEach(this.showLandingPage.bind(this));
    }

    UsbDetector._usbDetector.on('add', this.showLandingPage.bind(this));
  }
}