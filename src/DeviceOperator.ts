// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { TelemetryContext } from './telemetry';
import { ProjectHostType } from './Models/Interfaces/ProjectHostType';
import { askAndNewProject, handleIoTWorkspaceProjectFolder } from './utils';

const impor = require('impor')(__dirname);
const ioTWorkspaceProjectModule = impor(
  './Models/IoTWorkspaceProject'
) as typeof import('./Models/IoTWorkspaceProject');
const ioTContainerizedProjectModule = impor(
  './Models/IoTContainerizedProject'
) as typeof import('./Models/IoTContainerizedProject');

export class DeviceOperator {
  private projectHostType: ProjectHostType;
  constructor(projectHostType: ProjectHostType) {
    this.projectHostType = projectHostType;
  }

  async compile(
    context: vscode.ExtensionContext,
    channel: vscode.OutputChannel,
    telemetryContext: TelemetryContext
  ) {
    let iotProject;
    telemetryContext.properties.projectHostType =
      ProjectHostType[this.projectHostType];
    if (this.projectHostType === ProjectHostType.Container) {
      iotProject = new ioTContainerizedProjectModule.IoTContainerizedProject(
        context,
        channel,
        telemetryContext
      );
    } else if (this.projectHostType === ProjectHostType.Workspace) {
      iotProject = new ioTWorkspaceProjectModule.IoTWorkspaceProject(
        context,
        channel,
        telemetryContext
      );
    }
    if (iotProject === undefined) {
      await handleIoTWorkspaceProjectFolder(telemetryContext);
      return;
    }

    const result = await iotProject.load();
    if (!result) {
      await askAndNewProject(telemetryContext);
      return;
    }
    await iotProject.compile();
  }

  async upload(
    context: vscode.ExtensionContext,
    channel: vscode.OutputChannel,
    telemetryContext: TelemetryContext
  ) {
    let iotProject;
    telemetryContext.properties.projectHostType =
      ProjectHostType[this.projectHostType];
    if (this.projectHostType === ProjectHostType.Container) {
      iotProject = new ioTContainerizedProjectModule.IoTContainerizedProject(
        context,
        channel,
        telemetryContext
      );
    } else if (this.projectHostType === ProjectHostType.Workspace) {
      iotProject = new ioTWorkspaceProjectModule.IoTWorkspaceProject(
        context,
        channel,
        telemetryContext
      );
    }
    if (iotProject === undefined) {
      await handleIoTWorkspaceProjectFolder(telemetryContext);
      return;
    }

    const result = await iotProject.load();
    if (!result) {
      await askAndNewProject(telemetryContext);
      return;
    }
    await iotProject.upload();
  }

  async configDeviceSettings(
    context: vscode.ExtensionContext,
    channel: vscode.OutputChannel,
    telemetryContext: TelemetryContext
  ) {
    let iotProject;
    telemetryContext.properties.projectHostType =
      ProjectHostType[this.projectHostType];
    if (this.projectHostType === ProjectHostType.Container) {
      iotProject = new ioTContainerizedProjectModule.IoTContainerizedProject(
        context,
        channel,
        telemetryContext
      );
    } else if (this.projectHostType === ProjectHostType.Workspace) {
      iotProject = new ioTWorkspaceProjectModule.IoTWorkspaceProject(
        context,
        channel,
        telemetryContext
      );
    }
    if (iotProject === undefined) {
      await handleIoTWorkspaceProjectFolder(telemetryContext);
      return;
    }

    const result = await iotProject.load();
    if (!result) {
      await askAndNewProject(telemetryContext);
      return;
    }
    await iotProject.configDeviceSettings();
  }
}
