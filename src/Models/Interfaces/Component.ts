// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import {Guid} from 'guid-typescript';
import { OperatingResult } from '../../OperatingResult';

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
  load(): Promise<OperatingResult>;
  create(): Promise<OperatingResult>;
  checkPrerequisites(): Promise<OperatingResult>;
  getComponentType(): ComponentType;
}