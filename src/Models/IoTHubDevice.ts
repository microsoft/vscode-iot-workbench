import * as iothub from 'azure-iothub';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey} from '../constants';
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
      return false;
    }

    const toolkit = getExtension(extensionName.Toolkit);
    if (toolkit === undefined) {
      const error = new Error('Toolkit is not installed.');
      throw error;
    }

    let device = null;
    try {
      switch (selection.detail) {
        case 'select':
          device = await selectDevice(this.iotHubConnectionString);
          if (device === undefined) {
            throw new Error('Cannot select the specific device');
          } else {
            ConfigHandler.update(
                ConfigKey.iotHubDeviceConnectionString,
                device.iothubDeviceConnectionString);
          }

          break;
        case 'create':
          device = await createDevice(this.iotHubConnectionString);
          if (device === undefined) {
            const error = new Error('Cannot create device.');
            throw error;
          } else {
            ConfigHandler.update(
                ConfigKey.iotHubDeviceConnectionString,
                device.iothubDeviceConnectionString);
          }
          break;
        default:
          break;
      }
      return true;
    } catch (error) {
      throw error;
    }
  }
}

// As toolkit extension export api for device is not ready,
// the below code is a temp solution.

async function getDeviceList(iotHubConnectionString: string):
    Promise<vscode.QuickPickItem[]|undefined> {
  return new Promise(
      (resolve: (value: vscode.QuickPickItem[]|undefined) => void,
       reject: (error: Error) => void) => {
        const registry: iothub.Registry =
            iothub.Registry.fromConnectionString(iotHubConnectionString);
        registry.list((err, list) => {
          if (err) {
            return reject(err);
          }
          if (list === undefined) {
            return resolve(undefined);
          }

          const deviceList: vscode.QuickPickItem[] = [];
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
  const deviceList = await getDeviceList(iotHubConnectionString);
  if (deviceList === undefined) {
    return undefined;
  }
  const selection = await vscode.window.showQuickPick(
      deviceList, {ignoreFocusOut: true, placeHolder: 'Select IoT Hub device'});
  if (!selection || !selection.detail) {
    return undefined;
  }
  return ({'iothubDeviceConnectionString': selection.detail});
}

async function createDevice(iotHubConnectionString: string):
    Promise<DeviceInfo|undefined> {
  const deviceId =
      await vscode.window.showInputBox({prompt: 'Enter device ID to create'});

  if (!deviceId) {
    return undefined;
  }

  return await createDeviceWrapper(iotHubConnectionString, deviceId);
}

async function createDeviceWrapper(
    iotHubConnectionString: string,
    deviceId: string): Promise<DeviceInfo|undefined> {
  return new Promise(
      (resolve: (value: DeviceInfo) => void,
       reject: (error: Error) => void) => {
        const registry: iothub.Registry =
            iothub.Registry.fromConnectionString(iotHubConnectionString);
        const device: iothub.Registry.DeviceDescription = {deviceId};

        registry.create(device, (err, deviceInfo, res) => {
          if (err) {
            return reject(err);
          } else {
            if (deviceInfo === undefined) {
              return Promise.resolve(undefined);
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
              return Promise.resolve({
                'iothubDeviceConnectionString': iothubDeviceConnectionString
              });
            }
          }
        });
      });
}