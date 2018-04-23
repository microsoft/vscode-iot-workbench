// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import {ArduinoPackageManager} from './ArduinoPackageManager';
import {ConfigHandler} from './configHandler';
import {ConfigKey, ContentView, DeviceConfig} from './constants';

const DEVICE_INFO = [{
  deviceId: 'devkit',
  vendorId: DeviceConfig.az3166ComPortVendorId,
  productId: DeviceConfig.az3166ComPortProductId
}];

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

  static showLandingPage(device: DeviceInfo, context: vscode.ExtensionContext) {
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
      for (const deviceInfo of DEVICE_INFO) {
        const vendorId = Number('0x' + deviceInfo.vendorId);
        const productId = Number('0x' + deviceInfo.productId);
        if (vendorId === device.vendorId && productId === device.productId) {
          ArduinoPackageManager.installBoard(context, deviceInfo.deviceId);
          vscode.commands.executeCommand(
              'vscode.previewHtml',
              ContentView.workbenchExampleURI + '?' + deviceInfo.deviceId,
              vscode.ViewColumn.One, 'IoT Workbench Examples');
        }
      }
    }
  }

  static async startListening(context: vscode.ExtensionContext) {
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
      devices.forEach(device => UsbDetector.showLandingPage(device, context));
    }

    UsbDetector._usbDetector.on('add', UsbDetector.showLandingPage);
  }
}