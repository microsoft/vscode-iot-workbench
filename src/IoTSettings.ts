import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {ConfigHandler} from './configHandler';
import {PickWithData} from './Models/Interfaces/UI';

export class IoTWorkbenchSettings {
  private _workbenchPath: string;

  constructor() {
    const platform = os.platform();
    if (platform === 'win32') {
      this._workbenchPath = path.join(
          process.env.USERPROFILE, 'Documents', 'IoTWorkbenchProjects');
    } else if (platform === 'linux') {
      this._workbenchPath = path.join(process.env.HOME, 'IoTWorkbenchProjects');
    } else if (platform === 'darwin') {
      this._workbenchPath =
          path.join(process.env.HOME, 'Documents', 'IoTWorkbenchProjects');
    } else {
      this._workbenchPath = '/IoTWorkbenchProjects';
    }
  }

  async workbenchPath() {
    const userWorkbenchPath = ConfigHandler.get<string>('workbench');
    if (userWorkbenchPath) {
      return userWorkbenchPath;
    }

    return await this.setWorkbenchPath(false);
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
