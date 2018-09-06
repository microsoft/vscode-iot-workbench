// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, FileNames} from '../constants';
import {AZ3166Device} from '../Models/AZ3166Device';
import {Workspace} from '../Models/Interfaces/Workspace';

const constants = {
  deviceDefaultFolderName: 'Device'
};

export class CodeGenerator {
  async ScaffoldingDeviceStub(
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
      if (fileName.endsWith('template.json')) {
        templateItems.push({label: fileName, description: ''});
      }
    });

    const fileSelection = await vscode.window.showQuickPick(templateItems, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: 'Select a Plug & Play template file',
    });

    if (!fileSelection) {
      return;
    }

    const templatePath = path.join(pnpDeviceModelPath, fileSelection.label);

    // select the target of the code stub
    const languageItems: vscode.QuickPickItem[] =
        [{label: 'Ansi C', description: ''}, {label: 'C++', description: ''}];
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
        // TODO: Scaffolding code stub for DevKit
        await this.GenerateCodeForDevKit(context, rootPath, templatePath);
      }
    }
    return true;
  }

  async GenerateCodeForDevKit(
      context: vscode.ExtensionContext, rootPath: string,
      templateFilePath: string) {
    let needReload = false;
    const devicePath = ConfigHandler.get<string>(ConfigKey.devicePath);
    if (!devicePath) {
      needReload = true;

      // create and initialize the device folder
      const devicePath = path.join(rootPath, constants.deviceDefaultFolderName);
      if (!fs.existsSync(devicePath)) {
        fs.mkdirSync(devicePath);
      }

      // initialize az3166 device
      const devkitDevice =
          new AZ3166Device(context, devicePath, 'emptySketch.ino');
      devkitDevice.create();

      // TODO: Invoke PnP toolset to generate the code

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
          setTimeout(
              () => vscode.commands.executeCommand(
                  'vscode.openFolder', vscode.Uri.file(workspaceConfigFilePath),
                  false),
              1000);
          return true;
        } catch (error) {
          throw error;
        }
      }
    }
    return;
  }
}