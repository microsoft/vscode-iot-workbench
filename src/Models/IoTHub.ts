
import {ComponentType} from './Interfaces/Component';
import {Component} from './Interfaces/Component';
import {Provisionable} from './Interfaces/Provisionable';

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

  save(folderPath: string): boolean {
    return true;
  }

  provision(): boolean {
    return true;
  }
}
