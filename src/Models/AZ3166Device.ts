import {Component, ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';

export class AZ3166Device implements Device {
  private deviceType: DeviceType;
  private componentType: ComponentType;
  componentRootPath: string;

  constructor(rootPath: string) {
    this.deviceType = DeviceType.MXChip_AZ3166;
    this.componentType = ComponentType.Device;
    this.componentRootPath = rootPath;
  }

  getDeviceType(): DeviceType {
    return this.deviceType;
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

  compile(): boolean {
    return true;
  }

  upload(): boolean {
    return true;
  }
}
