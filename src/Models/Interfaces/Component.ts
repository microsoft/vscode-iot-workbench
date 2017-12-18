export enum ComponentType {
  Device = 1,
  IoTHub,
  AzureFunction
}

export interface Component {
  load(folderPath: string): boolean;
  create(): boolean;
  getComponentType(): ComponentType;
}
