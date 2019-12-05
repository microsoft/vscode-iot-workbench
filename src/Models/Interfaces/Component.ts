// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export enum ComponentType {
  Device = 1,
  IoTHub,
  AzureFunctions,
  IoTHubDevice,
  StreamAnalyticsJob,
  CosmosDB
}

export interface Component {
  name: string;
  id: string;
  load(): Promise<boolean>;
  create(): Promise<void>;
  checkPrerequisites(): Promise<boolean>;
  getComponentType(): ComponentType;
}