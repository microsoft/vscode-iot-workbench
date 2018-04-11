// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as os from 'os';
import * as vscode from 'vscode';

import {ConfigHandler} from './configHandler';
import {ContentView, DeviceConfig} from './constants';

const DEVICE_INFO = [{
  deviceId: 'devkit',
  vendorId: DeviceConfig.az3166ComPortVendorId,
  productId: DeviceConfig.az3166ComPortProductId
}];

export interface DeviceInfo {
  vendorId: number;
  productId: number;
}

export class UsbDetector {
  // tslint:disable-next-line: no-any
  private static _usbDetector: any =
      require('../../vendor/node-usb-native').detector;

  static showLandingPage(device: DeviceInfo) {
    if (device.vendorId && device.productId) {
      for (const deviceInfo of DEVICE_INFO) {
        const vendorId = Number('0x' + deviceInfo.vendorId);
        const productId = Number('0x' + deviceInfo.productId);
        if (vendorId === device.vendorId && productId === device.productId) {
          vscode.commands.executeCommand(
              'vscode.previewHtml',
              ContentView.workbenchExampleURI + '?' + deviceInfo.deviceId,
              vscode.ViewColumn.One, 'IoT Workbench Examples');
        }
      }
    }
  }

  static async startListening() {
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
      devices.forEach(UsbDetector.showLandingPage);
    }

    UsbDetector._usbDetector.on('add', UsbDetector.showLandingPage);
  }
}