import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

export class ConfigHandler {
  static async update(
      key: string, value: {}, target = vscode.ConfigurationTarget.Workspace) {
    if (!key) {
      throw new Error('Key is empty.');
    }

    return await vscode.workspace.getConfiguration('IoTDev').update(
        key, value, target);
  }

  static get<T>(key: string) {
    if (!key) {
      throw new Error('Key is empty.');
    }

    if (!vscode.workspace.getConfiguration('IoTDev').has(key)) {
      return undefined;
    }

    return vscode.workspace.getConfiguration('IoTDev').get<T>(key);
  }
}