// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as vscode from 'vscode';

import {CancelOperationError} from './CancelOperationError';
import {ConfigHandler} from './configHandler';
import {ConfigKey, OSPlatform} from './constants';
import {PickWithData} from './Models/Interfaces/UI';
import {getHomeDir, getPlatform} from './utils';

export class IoTWorkbenchSettings {
  private workbenchPath = '';
  private static instance: IoTWorkbenchSettings|undefined;

  private constructor() {}

  static async getInstance() {
    if (!this.instance) {
      this.instance = new IoTWorkbenchSettings();
      this.instance.workbenchPath =
          ConfigHandler.get<string>(ConfigKey.workbench) ||
          (await this.getDefaultWorkbenchPath());
      await ConfigHandler.update(
          ConfigKey.workbench, this.instance.workbenchPath,
          vscode.ConfigurationTarget.Global);
    }

    return this.instance;
  }

  static async getDefaultWorkbenchPath(): Promise<string> {
    const platform = await getPlatform();
    const homeDir = await getHomeDir();

    let _workbenchPath = '';
    if (platform === OSPlatform.WIN32) {
      _workbenchPath = path.join(homeDir, 'Documents', 'IoTWorkbenchProjects');
    } else if (platform === OSPlatform.LINUX) {
      _workbenchPath = path.join(homeDir, 'IoTWorkbenchProjects');
    } else if (platform === OSPlatform.DARWIN) {
      _workbenchPath = path.join(homeDir, 'Documents', 'IoTWorkbenchProjects');
    } else {
      _workbenchPath = '/IoTWorkbenchProjects';
    }

    return _workbenchPath;
  }

  getWorkbenchPath(): string {
    return ConfigHandler.get<string>(ConfigKey.workbench) || this.workbenchPath;
  }

  async setWorkbenchPath(showMessage = true): Promise<void> {
    let userWorkbenchPath = this.getWorkbenchPath();
    const workbenchPicks: Array<PickWithData<string>> = [
      {label: userWorkbenchPath, description: '', data: userWorkbenchPath},
      {label: '$(file-directory) Browse...', description: '', data: '$'}
    ];

    const selection = await vscode.window.showQuickPick(workbenchPicks, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: 'Select workbench folder'
    });

    if (selection && selection.data === '$') {
      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: 'Select',
        canSelectFolders: true,
        canSelectFiles: false
      };

      const folderUri = await vscode.window.showOpenDialog(options);
      if (folderUri && folderUri[0]) {
        userWorkbenchPath = folderUri[0].fsPath;
      } else {
        if (showMessage) {
          throw new CancelOperationError('Change workbench cancelled.');
        }
        return;
      }
    } else if (selection !== undefined) {
      userWorkbenchPath = selection.data;
    } else {
      userWorkbenchPath = '';
    }

    if (userWorkbenchPath) {
      await ConfigHandler.update(
          ConfigKey.workbench, userWorkbenchPath,
          vscode.ConfigurationTarget.Global);
      if (showMessage) {
        await vscode.window.showInformationMessage(
            'Change workbench successfully.');
      }
    }
  }
}
