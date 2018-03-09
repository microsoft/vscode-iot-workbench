import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

export class ConfigHandler {
  static async update(
      key: string, value: {}, target = vscode.ConfigurationTarget.Workspace) {
    if (!key) {
      throw new Error('Key is empty.');
    }

    return await vscode.workspace.getConfiguration('IoTWorkbench')
        .update(key, value, target);
  }

  static get<T>(key: string) {
    if (!key) {
      throw new Error('Key is empty.');
    }

    return vscode.workspace.getConfiguration('IoTWorkbench').get<T>(key);
  }
}