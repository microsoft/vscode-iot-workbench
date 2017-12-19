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
    const toolkitApi = getExtensionApi(ApiName.Toolkit);
    const iothub = await toolkitApi.azureIoTExplorer.createIoTHub();

    return new Promise(
        (resolve: (value: boolean) => void,
         reject: (value: boolean) => void) => {
          if (iothub && iothub.name) {
            // TODO: iothub & handle device
            resolve(true);
          } else {
            reject(false);
          }
        });
  }
}
