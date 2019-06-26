// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {TelemetryContext} from './telemetry';

const impor = require('impor')(__dirname);
const ioTProjectModule = impor('./Models/IoTWorkspaceProject') as
    typeof import('./Models/IoTWorkspaceProject');

export class AzureOperator {
  async Provision(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    const project = new ioTProjectModule.IoTWorkspaceProject(
        context, channel, telemetryContext);
    const result = await project.load();
    if (!result) {
      await project.handleLoadFailure();
      return;
    }
    const status = await project.provision();

    if (status) {
      vscode.window.showInformationMessage('Azure provision succeeded.');
    }

    return status;
  }

  async Deploy(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    const project = new ioTProjectModule.IoTWorkspaceProject(
        context, channel, telemetryContext);
    const result = await project.load();
    if (!result) {
      await project.handleLoadFailure();
      return;
    }
    await project.deploy();
  }
}
