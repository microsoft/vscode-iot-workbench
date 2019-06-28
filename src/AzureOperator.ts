// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {TelemetryContext} from './telemetry';
import {ProjectHostType} from './Models/Interfaces/ProjectHostType';

const impor = require('impor')(__dirname);
const ioTWorkspaceProjectModule = impor('./Models/IoTWorkspaceProject') as
    typeof import('./Models/IoTWorkspaceProject');
const ioTContainerizedProjectModule =
    impor('./Models/IoTContainerizedProject') as
    typeof import('./Models/IoTContainerizedProject');

export class AzureOperator {
  private projectHostType: ProjectHostType;

  constructor(projectHostType: ProjectHostType) {
    this.projectHostType = projectHostType;
  }

  async Provision(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    let status = false;
    if (this.projectHostType === ProjectHostType.Container) {
      const iotContainerProject =
          new ioTContainerizedProjectModule.IoTContainerizedProject(
              context, channel, telemetryContext);
      const result = await iotContainerProject.load();
      if (!result) {
        await iotContainerProject.handleLoadFailure();
        return;
      }
      status = await iotContainerProject.provision();
    } else if (this.projectHostType === ProjectHostType.Workspace) {
      const iotWorkspaceProject =
          new ioTWorkspaceProjectModule.IoTWorkspaceProject(
              context, channel, telemetryContext);
      const result = await iotWorkspaceProject.load();
      if (!result) {
        await iotWorkspaceProject.handleLoadFailure();
        return;
      }
      status = await iotWorkspaceProject.provision();
    }

    if (status) {
      vscode.window.showInformationMessage('Azure provision succeeded.');
    }

    return status;
  }

  async Deploy(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    if (this.projectHostType === ProjectHostType.Container) {
      const iotContainerProject =
          new ioTContainerizedProjectModule.IoTContainerizedProject(
              context, channel, telemetryContext);
      const result = await iotContainerProject.load();
      if (!result) {
        await iotContainerProject.handleLoadFailure();
        return;
      }
      await iotContainerProject.deploy();
    } else if (this.projectHostType === ProjectHostType.Workspace) {
      const iotWorkspaceProject =
          new ioTWorkspaceProjectModule.IoTWorkspaceProject(
              context, channel, telemetryContext);
      const result = await iotWorkspaceProject.load();
      if (!result) {
        await iotWorkspaceProject.handleLoadFailure();
        return;
      }
      await iotWorkspaceProject.deploy();
    }
  }
}
