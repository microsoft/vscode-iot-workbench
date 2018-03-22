// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';
import {IoTProject} from './Models/IoTProject';
import {TelemetryContext} from './telemetry';
import {AzureFunction} from './Models/AzureFunction';

export class AzureOperator {
  async Provision(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    if (!vscode.workspace.workspaceFolders) {
      throw new Error(
          'Unable to find the root path, please open an IoT Workbench project');
    }

    const project = new IoTProject(context, channel);
    const result = await project.load();
    if (!result) {
      throw new Error(
          'Unable to provision Azure objects, please open an IoT Workbench project and retry.');
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
    const project = new IoTProject(context, channel);
    const result = await project.load();
    if (!result) {
      throw new Error(
          'Unable to deploy Azure objects, please open an IoT Workbench project and retry.');
    }
    await project.deploy();
  }

  async CreateFunction(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    if (!vscode.workspace.workspaceFolders) {
      throw new Error(
          'Unable to find the root path, please open an IoT Workbench project.');
    }

    const azureFunctionPath = vscode.workspace.getConfiguration('IoTWorkbench')
                                  .get<string>('FunctionPath');
    if (!azureFunctionPath) {
      throw new Error('Get workspace configure file failed.');
    }

    const functionLocation = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath, '..',
        azureFunctionPath);

    const azureFunction = new AzureFunction(functionLocation, channel);
    const res = await azureFunction.initialize();
    vscode.window.showInformationMessage(
        res ? 'Function created.' : 'Function create failed.');
  }
}
