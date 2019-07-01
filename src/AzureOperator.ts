// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {TelemetryContext} from './telemetry';
import {ProjectHostType} from './Models/Interfaces/ProjectHostType';
import {askAndNewProject} from './utils';

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
    let iotProject;
    if (this.projectHostType === ProjectHostType.Container) {
      iotProject = new ioTContainerizedProjectModule.IoTContainerizedProject(
          context, channel, telemetryContext);
    } else if (this.projectHostType === ProjectHostType.Workspace) {
      iotProject = new ioTWorkspaceProjectModule.IoTWorkspaceProject(
          context, channel, telemetryContext);
    }
    if (iotProject === undefined) {
      const canBeIoTWorspaceProject =
          await ioTWorkspaceProjectModule.IoTWorkspaceProject
              .handleIoTWorkspaceProjectFolder(telemetryContext);
      if (!canBeIoTWorspaceProject) {
        await askAndNewProject(telemetryContext);
      }
      return;
    }

    const result = await iotProject.load();
    if (!result) {
      await askAndNewProject(telemetryContext);
      return;
    }
    status = await iotProject.provision();
    if (status) {
      vscode.window.showInformationMessage('Azure provision succeeded.');
    }

    return status;
  }

  async Deploy(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    let iotProject;
    if (this.projectHostType === ProjectHostType.Container) {
      iotProject = new ioTContainerizedProjectModule.IoTContainerizedProject(
          context, channel, telemetryContext);
    } else if (this.projectHostType === ProjectHostType.Workspace) {
      iotProject = new ioTWorkspaceProjectModule.IoTWorkspaceProject(
          context, channel, telemetryContext);
    }
    if (iotProject === undefined) {
      const canBeIoTWorspaceProject =
          await ioTWorkspaceProjectModule.IoTWorkspaceProject
              .handleIoTWorkspaceProjectFolder(telemetryContext);
      if (!canBeIoTWorspaceProject) {
        await askAndNewProject(telemetryContext);
      }
      return;
    }

    const result = await iotProject.load();
    if (!result) {
      await askAndNewProject(telemetryContext);
      return;
    }
    await iotProject.deploy();
  }
}
