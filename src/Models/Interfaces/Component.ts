// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

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
