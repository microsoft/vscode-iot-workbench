export enum ComponentType {
  Device = 1,
  IoTHub,
  AzureFunction
}

export interface Component {
  load(): Promise<boolean>;
  create(): Promise<boolean>;
  getComponentType(): ComponentType;
}
