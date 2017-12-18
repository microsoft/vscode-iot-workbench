import {Component, ComponentType} from './Interfaces/Component';
import {Provisionable} from './Interfaces/Provisionable';
import {ApiName} from './Interfaces/Api';
import {getExtensionApi} from './Apis';

export class IoTHub implements Component, Provisionable {
  private componentType: ComponentType;

  constructor() {
    this.componentType = ComponentType.IoTHub;
  }

  getComponentType(): ComponentType {
    return this.componentType;
  }

  load(folderPath: string): boolean {
    return true;
  }

  create(): boolean {
    return true;
  }

  async provision(): Promise<boolean> {
    const toolkitApi = getExtensionApi(ApiName.Toolkit);
    const iothub = await toolkitApi.azureIoTExplorer.createIoTHub();
    if (iothub && iothub.name) {
      // TODO: iothub & handle device
      return true;
    } else {
      return false;
    }
  }
}
