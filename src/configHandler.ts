import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

export class ConfigHandler {
  static update(key: string, value: {}) {
    if (!key) {
      throw new Error('Key is empty.');
    }

    return vscode.workspace.getConfiguration('IoTStudio')
        .update(key, value, vscode.ConfigurationTarget.Workspace);
  }

  static get<T>(key: string) {
    if (!key) {
      throw new Error('Key is empty.');
    }

    return vscode.workspace.getConfiguration('IoTStudio').get<T>(key);
  }
}