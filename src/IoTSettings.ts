import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {ConfigHandler} from './configHandler';

export class IoTDevSettings {
  private _workbenchPath: string;

  constructor() {
    const platform = os.platform();
    if (platform === 'win32') {
      this._workbenchPath =
          path.join(process.env.USERPROFILE, 'Documents', 'IoTProjects');
    } else if (platform === 'linux') {
      this._workbenchPath = path.join(process.env.HOME, 'IoTProjects');
    } else if (platform === 'darwin') {
      this._workbenchPath =
          path.join(process.env.HOME, 'Documents', 'IoTProjects');
    } else {
      this._workbenchPath = '/IoTProjects';
    }
  }

  async workbenchPath() {
    let userWorkbenchPath = ConfigHandler.get<string>('workbench');
    if (userWorkbenchPath) {
      return userWorkbenchPath;
    }

    const selection = await vscode.window.showInformationMessage(
        `Use this workbench to save projects: ${this._workbenchPath}`, 'OK',
        'Change');
    if (selection === 'OK') {
      userWorkbenchPath = this._workbenchPath;
    } else if (selection === 'Change') {
      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: 'Select',
        canSelectFolders: true,
        canSelectFiles: false
      };

      const folderUri = await vscode.window.showOpenDialog(options);
      if (folderUri && folderUri[0]) {
        userWorkbenchPath = folderUri[0].fsPath;
      }
    } else {
      userWorkbenchPath = undefined;
    }

    if (userWorkbenchPath) {
      await ConfigHandler.update(
          'workbench', userWorkbenchPath, vscode.ConfigurationTarget.Global);
    }
    return userWorkbenchPath;
  }

  async setWorkbenchPath() {
    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      openLabel: 'Select',
      canSelectFolders: true,
      canSelectFiles: false
    };

    const folderUri = await vscode.window.showOpenDialog(options);
    if (folderUri && folderUri[0]) {
      const userWorkbenchPath = folderUri[0].fsPath;
      await ConfigHandler.update(
          'workbench', userWorkbenchPath, vscode.ConfigurationTarget.Global);
      await vscode.window.showInformationMessage(
          'Change workbench successfully.');
    }
  }
}
