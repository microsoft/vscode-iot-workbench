// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as vscode from 'vscode';

import { CancelOperationError } from './CancelOperationError';
import { ConfigHandler } from './configHandler';
import { ConfigKey, OSPlatform } from './constants';
import { PickWithData } from './Models/Interfaces/UI';
import { getHomeDir, getPlatform } from './utils';

export class IoTWorkbenchSettings {
  private workbenchPath = '';
  private static instance: IoTWorkbenchSettings|undefined;

  private constructor() {}

  static async getInstance(): Promise<IoTWorkbenchSettings> {
    if (!IoTWorkbenchSettings.instance) {
      IoTWorkbenchSettings.instance = new IoTWorkbenchSettings();
      IoTWorkbenchSettings.instance.workbenchPath =
          ConfigHandler.get<string>(ConfigKey.workbench) ||
          (await this.getDefaultWorkbenchPath());
      await ConfigHandler.update(
        ConfigKey.workbench, IoTWorkbenchSettings.instance.workbenchPath,
        vscode.ConfigurationTarget.Global);
    }

    return IoTWorkbenchSettings.instance;
  }

  static async getDefaultWorkbenchPath(): Promise<string> {
    const platform = await getPlatform();
    const homeDir = await getHomeDir();

    let workbenchPath = '';
    if (platform === OSPlatform.WIN32) {
      workbenchPath = path.join(homeDir, 'Documents', 'IoTWorkbenchProjects');
    } else if (platform === OSPlatform.LINUX) {
      workbenchPath = path.join(homeDir, 'IoTWorkbenchProjects');
    } else if (platform === OSPlatform.DARWIN) {
      workbenchPath = path.join(homeDir, 'Documents', 'IoTWorkbenchProjects');
    } else {
      workbenchPath = '/IoTWorkbenchProjects';
    }

    return workbenchPath;
  }

  getWorkbenchPath(): string {
    return ConfigHandler.get<string>(ConfigKey.workbench) || this.workbenchPath;
  }

  async setWorkbenchPath(): Promise<void> {
    const selection = await this.selectWorkbenchPath();

    let userWorkbenchPath;
    if (selection.data === '$') {
      userWorkbenchPath = await this.selectFolder();
    } else {
      userWorkbenchPath = selection.data;
    }

    if (userWorkbenchPath) {
      await ConfigHandler.update(
        ConfigKey.workbench, userWorkbenchPath,
        vscode.ConfigurationTarget.Global);
      await vscode.window.showInformationMessage(
        'Change workbench successfully.');
    }
  }

  private async selectWorkbenchPath(): Promise<PickWithData<string>> {
    const userWorkbenchPath = this.getWorkbenchPath();
    const workbenchPicks: Array<PickWithData<string>> = [
      { label: userWorkbenchPath, description: '', data: userWorkbenchPath },
      { label: '$(file-directory) Browse...', description: '', data: '$' }
    ];

    const selection = await vscode.window.showQuickPick(workbenchPicks, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: 'Select workbench folder'
    });

    if (!selection) {
      throw new CancelOperationError('Workbench path selection cancelled.');
    }
    return selection;
  }

  private async selectFolder(): Promise<string> {
    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      openLabel: 'Select',
      canSelectFolders: true,
      canSelectFiles: false
    };

    const folderUri = await vscode.window.showOpenDialog(options);
    if (!folderUri || folderUri.length === 0) {
      throw new CancelOperationError('Folder selection cancelled.');
    }

    return folderUri[0].fsPath;
  }
}
