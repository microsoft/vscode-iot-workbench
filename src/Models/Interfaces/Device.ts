// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ScaffoldType } from '../../constants';

import { Compilable } from './Compilable';
import { Component } from './Component';
import { Uploadable } from './Uploadable';

export enum DeviceType {
  MXChipAZ3166 = 1,
  IoTButton = 2,
  Esp32 = 3,
  RaspberryPi = 4
}

export interface Device extends Component, Compilable, Uploadable {
  getDeviceType(): DeviceType;
  configDeviceSettings(): Promise<boolean>;
  configDeviceEnvironment(deviceRootPath: string, scaffoldType: ScaffoldType):
      Promise<void>;
}
