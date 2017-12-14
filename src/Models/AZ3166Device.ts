import {ComponentType} from './Interfaces/Component';
import {Component} from './Interfaces/Component';
import {Device} from './Interfaces/Device';
import {DeviceType} from './Interfaces/Device';

export class AZ3166Device implements Device {
  private deviceType: DeviceType;
  private componentType: ComponentType;

  constructor() {
    this.deviceType = DeviceType.MXChip_AZ3166;
    this.componentType = ComponentType.Device;
  }

  getDeviceType(): DeviceType {
    return this.deviceType;
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

  compile(): boolean {
    return true;
  }

  upload(): boolean {
    return true;
  }
}
