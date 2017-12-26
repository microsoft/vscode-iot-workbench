import * as iothub from 'azure-iothub';
import * as vscode from 'vscode';
import {ConfigurationTarget} from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey} from '../constants';
import {ExceptionHelper} from '../exceptionHelper';

import {getExtension} from './Apis';
import {extensionName} from './Interfaces/Api';
import {Component, ComponentType} from './Interfaces/Component';
import {Provisionable} from './Interfaces/Provisionable';

interface DeviceInfo {
  iothubDeviceConnectionString: string;
}

export class IoTHubDevice {
  private iotHubConnectionString: string;

  constructor() {
    this.iotHubConnectionString =
        ConfigHandler.get(ConfigKey.iotHubConnectionString);
  }

  async provision(): Promise<boolean> {
    return new Promise(
        async (
            resolve: (value: boolean) => void,
            reject: (value: boolean) => void) => {
          const provisionIothubDeviceSelection: vscode.QuickPickItem[] = [
            {
              label: 'Select an existed IoT Hub device',
              description: 'Select an existed IoT Hub device',
              detail: 'select'
            },
            {
              label: 'Create a new IoT Hub device',
              description: 'Create a new IoT Hub device',
              detail: 'create'
            }
          ];
          const selection = await vscode.window.showQuickPick(
              provisionIothubDeviceSelection,
              {ignoreFocusOut: true, placeHolder: 'Provision IoTHub Device'});

          if (!selection) {
            reject(false);
            return;
          }

          const toolkit = getExtension(extensionName.Toolkit);
          if (toolkit === undefined) {
            reject(false);
            return;
          }

          let device = null;
          try {
            switch (selection.detail) {
              case 'select':
                device = await selectDevice(this.iotHubConnectionString);
                if (device === undefined) {
                  ExceptionHelper.logError(
                      'Cannot select the specific device', true);
                } else {
                  ConfigHandler.update(
                      ConfigKey.iotHubDeviceConnectionString,
                      device.iothubDeviceConnectionString);
                }

                break;
              case 'create':
                device = await createDevice(this.iotHubConnectionString);
                if (device === undefined) {
                  ExceptionHelper.logError('Cannot create device', true);
                } else {
                  ConfigHandler.update(
                      ConfigKey.iotHubDeviceConnectionString,
                      device.iothubDeviceConnectionString);
                }

                break;
              default:
                break;
            }
          } catch (e) {
            throw e;
          }
        });
  }
}

// As toolkit extension export api for device is not ready,
// the below code is a temp solution.

async function getDeviceList(iotHubConnectionString: string):
    Promise<vscode.QuickPickItem[]|undefined> {
  return new Promise(
      async (
          resolve: (value: vscode.QuickPickItem[]) => void,
          reject: (value: undefined) => void) => {
        const registry: iothub.Registry =
            iothub.Registry.fromConnectionString(iotHubConnectionString);
        const deviceList: vscode.QuickPickItem[] = [];
        registry.list((err, list) => {
          if (list === undefined) {
            reject(undefined);
            return;
          }

          const hostnameMatch = iotHubConnectionString.match(/HostName=(.*?);/);
          let hostname: string|null = null;
          if (hostnameMatch !== null && hostnameMatch.length > 1) {
            hostname = hostnameMatch[1];
          }

          list.forEach(deviceInfo => {
            const deviceId = deviceInfo.deviceId;
            let deviceKey = null;
            if (deviceInfo.authentication &&
                deviceInfo.authentication.symmetricKey) {
              deviceKey = deviceInfo.authentication.symmetricKey.primaryKey;
            }
            const iothubDeviceConnectionString =
                `HostName=${hostname as string};DeviceId=${
                    deviceId};SharedAccessKey=${deviceKey}`;
            deviceList.push({
              label: deviceId,
              description: hostname as string,
              detail: iothubDeviceConnectionString
            });
          });

          resolve(deviceList);
        });
      });
}

async function selectDevice(iotHubConnectionString: string):
    Promise<DeviceInfo|undefined> {
  return new Promise(
      async (
          resolve: (value: DeviceInfo) => void,
          reject: (value: undefined) => void) => {
        const deviceList = await getDeviceList(iotHubConnectionString);
        if (deviceList === undefined) {
          reject(undefined);
          return;
        }
        const selection = await vscode.window.showQuickPick(
            deviceList,
            {ignoreFocusOut: true, placeHolder: 'Select IoT Hub device'});
        if (!selection || !selection.detail) {
          reject(undefined);
          return;
        }
        resolve({'iothubDeviceConnectionString': selection.detail});
      });
}

async function createDevice(iotHubConnectionString: string):
    Promise<DeviceInfo|undefined> {
  return new Promise(
      async (
          resolve: (value: DeviceInfo) => void,
          reject: (value: undefined) => void) => {
        const registry: iothub.Registry =
            iothub.Registry.fromConnectionString(iotHubConnectionString);

        const deviceId = await vscode.window.showInputBox(
            {prompt: 'Enter device ID to create'});

        if (!deviceId) {
          reject(undefined);
          return;
        }

        const device: iothub.Registry.DeviceDescription = {deviceId};

        registry.create(device, (err, deviceInfo, res) => {
          if (err) {
            reject(undefined);
          } else {
            if (deviceInfo === undefined) {
              reject(undefined);
            } else {
              const hostnameMatch =
                  iotHubConnectionString.match(/HostName=(.*?);/);
              let hostname: string|null = null;
              if (hostnameMatch !== null && hostnameMatch.length > 1) {
                hostname = hostnameMatch[1];
              }

              const deviceId = deviceInfo.deviceId;
              let deviceKey = null;
              if (deviceInfo.authentication &&
                  deviceInfo.authentication.symmetricKey) {
                deviceKey = deviceInfo.authentication.symmetricKey.primaryKey;
              }
              const iothubDeviceConnectionString = `HostName=${
                  hostname};DeviceId=${deviceId};SharedAccessKey=${deviceKey}`;
              resolve({
                'iothubDeviceConnectionString': iothubDeviceConnectionString
              });
            }
          }
        });
      });
}