export enum ComponentType {
  Device = 1,
  IoTHub,
  AzureFunction,
  IoTHubDevice
}

export interface Component {
  name: string;
  load(): Promise<boolean>;
  create(): Promise<boolean>;
  getComponentType(): ComponentType;
}
