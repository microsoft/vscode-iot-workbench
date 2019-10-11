// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as vscode from 'vscode';
import * as sdk from 'vscode-iot-device-cube-sdk';

import {ConfigHandler} from './configHandler';
import {PickWithData} from './Models/Interfaces/UI';

export class IoTWorkbenchSettings {
  private _workbenchPath = '';

  private constructor() {}

  static async createAsync() {
    const iotWorkbenchSettings = new IoTWorkbenchSettings();

    iotWorkbenchSettings._workbenchPath =
        await IoTWorkbenchSettings.getWorkbenchPath();

    return iotWorkbenchSettings;
  }

  static async getPlatform(): Promise<string> {
    const localOs = sdk.Utility.require('os') as typeof import('os');
    const getPlatform = await localOs.platform;
    const platform = await getPlatform();
    return platform;
  }

  static async getOs(): Promise<string> {
    const localOs = sdk.Utility.require('os') as typeof import('os');
    const getHomeDir = await localOs.homedir;
    const homeDir = await getHomeDir();
    return homeDir;
  }

  static async getWorkbenchPath(): Promise<string> {
    const localOs = sdk.Utility.require('os') as typeof import('os');
    const getHomeDir = await localOs.homedir;
    const homeDir = await getHomeDir();
    const getPlatform = await localOs.platform;
    const platform = await getPlatform();

    let _workbenchPath = '';
    if (platform === 'win32') {
      _workbenchPath = path.join(homeDir, 'Documents', 'IoTWorkbenchProjects');
    } else if (platform === 'linux') {
      _workbenchPath = path.join(homeDir, 'IoTWorkbenchProjects');
    } else if (platform === 'darwin') {
      _workbenchPath = path.join(homeDir, 'Documents', 'IoTWorkbenchProjects');
    } else {
      _workbenchPath = '/IoTWorkbenchProjects';
    }

    return _workbenchPath;
  }

  async workbenchPath() {
    const userWorkbenchPath = ConfigHandler.get<string>('workbench');
    if (userWorkbenchPath) {
      return userWorkbenchPath;
    } else {
      // Use the default value for workbenchPath.
      await ConfigHandler.update(
          'workbench', this._workbenchPath, vscode.ConfigurationTarget.Global);
      return this._workbenchPath;
    }
  }

  async setWorkbenchPath(showMessage = true) {
    let userWorkbenchPath: string|undefined =
        ConfigHandler.get<string>('workbench') || this._workbenchPath;
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
          await vscode.window.showWarningMessage('Change workbench cancelled.');
        }
        return userWorkbenchPath;
      }
    } else if (selection !== undefined) {
      userWorkbenchPath = selection.data;
    } else {
      userWorkbenchPath = undefined;
    }

    if (userWorkbenchPath) {
      await ConfigHandler.update(
          'workbench', userWorkbenchPath, vscode.ConfigurationTarget.Global);
      if (showMessage) {
        await vscode.window.showInformationMessage(
            'Change workbench successfully.');
      }
    }
    return userWorkbenchPath;
  }
}
