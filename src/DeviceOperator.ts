// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import {TelemetryContext} from './telemetry';
import {constructAndLoadIoTProject} from './utils';
import {ProjectEnvironmentConfiger} from './ProjectEnvironmentConfiger';

export class DeviceOperator {
  async compile(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    const iotProject =
        await constructAndLoadIoTProject(context, channel, telemetryContext);
    if (!iotProject) {
      return;
    }
    await iotProject.compile();
  }

  async upload(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    const iotProject =
        await constructAndLoadIoTProject(context, channel, telemetryContext);
    if (!iotProject) {
      return;
    }
    await iotProject.upload();
  }

  async configDeviceSettings(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    const iotProject =
        await constructAndLoadIoTProject(context, channel, telemetryContext);
    if (!iotProject) {
      return;
    }
    await iotProject.configDeviceSettings();
  }
}
