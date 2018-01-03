import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey} from '../constants';

import {getExtension} from './Apis';
import {extensionName} from './Interfaces/Api';
import {Component, ComponentType} from './Interfaces/Component';
import {Provisionable} from './Interfaces/Provisionable';
import {IoTHubDevice} from './IoTHubDevice';

export class IoTHub implements Component, Provisionable {
  private componentType: ComponentType;

  constructor() {
    this.componentType = ComponentType.IoTHub;
  }

  getComponentType(): ComponentType {
    return this.componentType;
  }

  async load(): Promise<boolean> {
    return new Promise(
        async (
            resolve: (value: boolean) => void,
            reject: (value: boolean) => void) => {
          resolve(true);
        });
  }


  create(): boolean {
    return true;
  }

  async provision(): Promise<boolean> {
    return new Promise(
        async (
            resolve: (value: boolean) => void,
            reject: (value: Error) => void) => {
          const provisionIothubSelection: vscode.QuickPickItem[] = [
            {
              label: 'Select an existed IoT Hub',
              description: 'Select an existed IoT Hub',
              detail: 'select'
            },
            {
              label: 'Create a new IoT Hub',
              description: 'Create a new IoT Hub',
              detail: 'create'
            }
          ];
          const selection = await vscode.window.showQuickPick(
              provisionIothubSelection,
              {ignoreFocusOut: true, placeHolder: 'Provision IoT Hub'});

          if (!selection) {
            resolve(false);
            return;
          }

          const toolkit = getExtension(extensionName.Toolkit);
          if (toolkit === undefined) {
            const error = new Error('Toolkit is not installed.');
            reject(error);
            return;
          }

          let iothub = null;
          switch (selection.detail) {
            case 'select':
              iothub = await toolkit.azureIoTExplorer.selectIoTHub(true);
              break;
            case 'create':
              iothub = await toolkit.azureIoTExplorer.createIoTHub(true);
              break;
            default:
              break;
          }

          if (iothub && iothub.iotHubConnectionString) {
            ConfigHandler.update(
                ConfigKey.iotHubConnectionString,
                iothub.iotHubConnectionString);
            const device = new IoTHubDevice();
            if (await device.provision()) {
              resolve(true);
            } else {
              const error = new Error('Device provision failed.');
              reject(error);
            }
            resolve(true);
          } else {
            const error = new Error('IoT Hub provision failed.');
            reject(error);
          }
        });
  }
}
