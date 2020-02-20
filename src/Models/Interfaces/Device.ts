// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ScaffoldType } from "../../constants";

import { Compilable } from "./Compilable";
import { Component } from "./Component";
import { Uploadable } from "./Uploadable";

export enum DeviceType {
  MXChipAZ3166 = 1,
  Esp32 = 2,
  RaspberryPi = 3
}

export interface Device extends Component, Compilable, Uploadable {
  getDeviceType(): DeviceType;
  configDeviceSettings(): Promise<void>;
  configDeviceEnvironment(deviceRootPath: string, scaffoldType: ScaffoldType): Promise<void>;
}
