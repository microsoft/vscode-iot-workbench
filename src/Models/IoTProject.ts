import {Component} from './Interfaces/Component';
import {Provisionable} from './Interfaces/Provisionable';

export class IoTProject {
  private componentList: Component[];

  private addComponent(comp: Component) {}

  private canProvision(comp: {}): comp is Provisionable {
    return (comp as Provisionable).provision !== undefined;
  }

  load(folderPath: string): boolean {
    return true;
  }

  save(folderPath: string): boolean {
    return true;
  }

  compile(): boolean {
    return true;
  }

  upload(): boolean {
    return true;
  }

  provision(): boolean {
    for (const item of this.componentList) {
      if (this.canProvision(item)) {
        // TODO: provision each components
      }
    }
    return true;
  }

  deploy(): boolean {
    return true;
  }

  setDeviceConnectionString(deviceConnectionString: string): boolean {
    return true;
  }
}
