import * as vscode from 'vscode';

import {exceptionHelper} from '../exceptionHelper';

import {getExtensionApi} from './Apis';
import {ApiName} from './Interfaces/Api';
import {Component, ComponentType} from './Interfaces/Component';
import {Provisionable} from './Interfaces/Provisionable';

export class IoTHub implements Component, Provisionable {
  private componentType: ComponentType;

  constructor() {
    this.componentType = ComponentType.IoTHub;
  }

  getComponentType(): ComponentType {
    return this.componentType;
  }

  load(): boolean {
    return true;
  }

  create(): boolean {
    return true;
  }

  async provision(): Promise<boolean> {
    return new Promise(
        async (
            resolve: (value: boolean) => void,
            reject: (value: boolean) => void) => {
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
            reject(false);
            return;
          }

          const toolkitApi = getExtensionApi(ApiName.Toolkit);
          if (toolkitApi === null) {
            reject(false);
            return;
          }

          let iothub = null;
          switch (selection.detail) {
            case 'select':
              iothub = await toolkitApi.selectIoTHub();
              break;
            case 'create':
              iothub = await toolkitApi.createIoTHub();
              break;
            default:
              break;
          }

          if (iothub && iothub.name) {
            // TODO: iothub & handle device
            resolve(true);
          } else {
            reject(false);
          }
        });
  }
}
