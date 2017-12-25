export enum ComponentType {
  Device = 1,
  IoTHub,
  AzureFunction
}

export interface Component {
  load(): boolean;
  create(): boolean;
  getComponentType(): ComponentType;
}
