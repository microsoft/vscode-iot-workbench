import {Component, ComponentType} from './Interfaces/Component';
import {Provisionable} from './Interfaces/Provisionable';
import {getApi} from './Apis';

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
    const toolkitApi = getApi('azure-iot-toolkit');
    const iothub = await toolkitApi.azureIoTExplorer.createIoTHub();
    if (iothub && iothub.name) {
      // TODO: handle device
      return true;
    } else {
      return false;
    }
  }
}
