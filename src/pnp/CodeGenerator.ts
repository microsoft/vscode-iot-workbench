// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as os from 'os';
import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, FileNames} from '../constants';
import {AZ3166Device} from '../Models/AZ3166Device';
import {Workspace} from '../Models/Interfaces/Workspace';
import * as utils from '../utils';

const constants = {
  deviceDefaultFolderName: 'Device'
};

export class CodeGenerator {
  async ScaffoldDeviceStub(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel) {
    const pnpDeviceModelFolder =
        ConfigHandler.get<string>(ConfigKey.pnpDeviceModelPath);
    if (!pnpDeviceModelFolder) {
      const message = 'Unable to find the folder for device model.';
      vscode.window.showErrorMessage(message);
      return false;
    }

    if (!vscode.workspace.workspaceFolders) {
      return false;
    }

    const rootPath =
        path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '..');
    const pnpDeviceModelPath = path.join(rootPath, pnpDeviceModelFolder);
    if (!pnpDeviceModelPath) {
      const message = 'Unable to find the folder for device model.';
      vscode.window.showErrorMessage(message);
      return false;
    }

    // Step 1: list all template from device model folder for selection.
    const templateFiles = fs.listSync(pnpDeviceModelPath);
    if (!templateFiles || templateFiles.length === 0) {
      const message = 'Unable to find device model files in the device model.';
      vscode.window.showWarningMessage(message);
      return false;
    }

    const templateItems: vscode.QuickPickItem[] = [];
    templateFiles.forEach((filePath: string) => {
      const fileName = path.basename(filePath);
      // Currently, PnP CLI only supports generating code for interface.json
      // TODO: Update this part when Pnp CLI supports template.json
      if (fileName.endsWith('.template.json') ||
          fileName.endsWith('.interface.json')) {
        templateItems.push({label: fileName, description: ''});
      }
    });

    const fileSelection = await vscode.window.showQuickPick(templateItems, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: 'Select a Plug & Play device model file',
    });

    if (!fileSelection) {
      return;
    }

    const templatePath = path.join(pnpDeviceModelPath, fileSelection.label);

    // select the target of the code stub
    const languageItems: vscode.QuickPickItem[] =
        [{label: 'C++', description: ''}];
    const languageSelection = await vscode.window.showQuickPick(
        languageItems,
        {ignoreFocusOut: true, placeHolder: 'Please select a language:'});

    if (!languageSelection) {
      return false;
    }

    if (languageSelection.label === 'C++') {
      const targetItems: vscode.QuickPickItem[] = [
        {label: 'MXChip IoT DevKit', description: ''},
        {label: 'Export', description: ''}
      ];
      const targetSelection = await vscode.window.showQuickPick(
          targetItems,
          {ignoreFocusOut: true, placeHolder: 'Please select a target:'});

      if (!targetSelection) {
        return false;
      }

      if (targetSelection.label === 'MXChip IoT DevKit') {
        await this.GenerateCppCodeForDevKit(
            context, rootPath, templatePath, channel);
      } else if (targetSelection.label === 'Export') {
        await this.GenerateCppCodeForExport(templatePath, channel);
      }
    }
    return true;
  }

  async GenerateCppCodeForDevKit(
      context: vscode.ExtensionContext, rootPath: string,
      templateFilePath: string, channel: vscode.OutputChannel) {
    let needReload = false;
    let devicePath = '';
    const deviceFolderName = ConfigHandler.get<string>(ConfigKey.devicePath);
    if (!deviceFolderName) {
      needReload = true;

      // create and initialize the device folder
      devicePath = path.join(rootPath, constants.deviceDefaultFolderName);
      if (!fs.existsSync(devicePath)) {
        fs.mkdirSync(devicePath);
      }
    } else {
      devicePath = path.join(rootPath, deviceFolderName);
    }

    // create the path for src. In Arduino, only files under src folder are
    // compiled together with sketch file.
    const sourcePath = path.join(devicePath, 'src');
    if (!fs.existsSync(sourcePath)) {
      fs.mkdirSync(sourcePath);
    }

    // initialize az3166 device
    // if the ino file is already created, skip this step

    const sketchFiles = fs.listSync(devicePath, ['ino']);
    if (!sketchFiles || sketchFiles.length === 0) {
      const devkitDevice =
          new AZ3166Device(context, devicePath, 'emptySketch.ino');
      await devkitDevice.create();
    }

    // Generate the folder for the code stub
    const fileName = path.basename(templateFilePath);
    // myinterface.template.json => myinterface
    const libPath =
        path.join(sourcePath, fileName.substr(0, fileName.indexOf('.')));
    if (!fs.existsSync(libPath)) {
      fs.mkdirSync(libPath);
    }

    // Invoke PnP toolset to generate the code
    await this.GenerateCppCode(libPath, templateFilePath, channel);

    if (needReload) {
      // load the workspace file
      const workspaceConfigFilePath =
          path.join(rootPath, FileNames.workspaceConfigFilePath);
      const workspace: Workspace =
          JSON.parse(fs.readFileSync(workspaceConfigFilePath, 'utf8')) as
          Workspace;
      workspace.folders.push({path: constants.deviceDefaultFolderName});
      workspace.settings[`IoTWorkbench.${ConfigKey.devicePath}`] =
          constants.deviceDefaultFolderName;
      workspace.settings[`IoTWorkbench.${ConfigKey.boardId}`] =
          AZ3166Device.boardId;

      fs.writeFileSync(
          workspaceConfigFilePath, JSON.stringify(workspace, null, 4));

      try {
        vscode.commands.executeCommand('workbench.action.reloadWindow');
        return true;
      } catch (error) {
        throw error;
      }
    }
    return;
  }

  async GenerateCppCodeForExport(
      templateFilePath: string, channel: vscode.OutputChannel) {
    let rootPath: string;
    // Ask user to select a folder to export
    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      openLabel: 'Select a folder to export:',
      canSelectFolders: true,
      canSelectFiles: false
    };
    const folderUri = await vscode.window.showOpenDialog(options);
    if (folderUri && folderUri[0]) {
      console.log(`Selected folder: ${folderUri[0].fsPath}`);
      rootPath = folderUri[0].fsPath;
      await this.GenerateCppCode(rootPath, templateFilePath, channel);
    }
  }

  async GenerateCppCode(
      targetPath: string, templateFilePath: string,
      channel: vscode.OutputChannel) {
    // Invoke PnP toolset to generate the code
    const platform = os.platform();
    const homeDir = os.homedir();
    let cmdPath = '';
    if (platform === 'win32' || platform === 'darwin') {
      cmdPath = path.join(homeDir, 'PnP-CLI');
    } else {
      return;
    }

    const command = `IoTPnP.Cli.exe scaffold  --jsonldUri "${
        templateFilePath}" --language cpp  --output "${targetPath}"`;

    channel.show();
    channel.appendLine('IoT Workbench: scaffold code stub.');
    await utils.runCommand(command, cmdPath, channel);
    channel.appendLine('IoT Workbench: scaffold code stub completed.');
    return;
  }
}