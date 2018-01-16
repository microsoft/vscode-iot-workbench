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
  private channel: vscode.OutputChannel;

  constructor(channel: vscode.OutputChannel) {
    this.componentType = ComponentType.IoTHub;
    this.channel = channel;
  }

  getComponentType(): ComponentType {
    return this.componentType;
  }

  async load(): Promise<boolean> {
    return true;
  }


  create(): boolean {
    return true;
  }

  async provision(): Promise<boolean> {
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
      return false;
    }

    const toolkit = getExtension(extensionName.Toolkit);
    if (toolkit === undefined) {
      const error = new Error('Toolkit is not installed.');
      throw error;
    }

    let iothub = null;
    switch (selection.detail) {
      case 'select':
        iothub = await toolkit.azureIoTExplorer.selectIoTHub(true);
        break;
      case 'create':
        if (this.channel) {
          this.channel.show();
          this.channel.appendLine('Creating new IoT Hub...');
        }

        iothub =
            await toolkit.azureIoTExplorer.createIoTHub(true, this.channel);
        break;
      default:
        break;
    }

    if (iothub && iothub.iotHubConnectionString) {
      if (this.channel) {
        this.channel.show();
        this.channel.appendLine(JSON.stringify(iothub, null, 2));
      }

      ConfigHandler.update(
          ConfigKey.iotHubConnectionString, iothub.iotHubConnectionString);
      const device = new IoTHubDevice(this.channel);
      if (await device.provision()) {
        return true;
      } else {
        const error = new Error('Device provision failed.');
        throw error;
      }
    } else {
      const error = new Error('IoT Hub provision failed.');
      throw error;
    }
  }
}