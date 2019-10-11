// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {TelemetryContext} from './telemetry';
import {constructAndLoadIoTProject} from './utils';
import {RemoteExtension} from './Models/RemoteExtension';
import {CancelOperationError} from './CancelOperationError';


export class AzureOperator {
  async provision(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    const iotProject =
        await constructAndLoadIoTProject(context, channel, telemetryContext);
    if (!iotProject) {
      return;
    }
    const status = await iotProject.provision();
    if (status) {
      vscode.window.showInformationMessage('Azure provision succeeded.');
    }
  }

  async deploy(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    if (RemoteExtension.isRemote(context)) {
      const message =
          `The project is currently open in container now. 'Azure IoT Device Workbench: Depoly to Azure...' is not supported inside the container.`;
      vscode.window.showWarningMessage(message);

      telemetryContext.properties.errorMessage = message;
      return;
    }

    const iotProject =
        await constructAndLoadIoTProject(context, channel, telemetryContext);
    if (iotProject) {
      try {
        await iotProject.deploy();
      } catch (error) {
        if (error instanceof CancelOperationError) {
          telemetryContext.properties.errorMessage = error.message;
          telemetryContext.properties.result = 'Cancelled';
          return;
        } else {
          throw error;
        }
      }
    }
  }
}
