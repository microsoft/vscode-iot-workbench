// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import {Guid} from 'guid-typescript';

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
  folder?: string;
  load(): Promise<boolean>;
  create(): Promise<boolean>;
  getComponentType(): ComponentType;
}