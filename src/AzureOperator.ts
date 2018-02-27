'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';
import {IoTProject} from './Models/IoTProject';

export class AzureOperator {
  async Provision(
      context: vscode.ExtensionContext,
      channel: vscode.OutputChannel): Promise<boolean> {
    if (!vscode.workspace.workspaceFolders) {
      throw new Error(
          'Unable to find the root path, please open an IoT Development project');
    }

    const project = new IoTProject(context, channel);
    project.load();
    const status = await project.provision();
    return status;
  }

  async Deploy(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel) {
    const project = new IoTProject(context, channel);
    project.load();
    await project.deploy();
  }
}
