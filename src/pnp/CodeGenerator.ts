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
import {IoTProject} from '../Models/IoTProject';
import * as utils from '../utils';
import {TelemetryContext} from '../telemetry';
import {ProjectTemplate,} from '../Models/Interfaces/ProjectTemplate';

const constants = {
  deviceDefaultFolderName: 'Device'
};

export class CodeGenerator {
  async ScaffoldDeviceStub(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    if (!vscode.workspace.workspaceFolders) {
      return false;
    }

    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    if (!rootPath) {
      const message =
          'Unable to find the folder for device model files. Please select a folder first';
      vscode.window.showWarningMessage(message);
      return false;
    }

    // Step 1: list all template from device model folder for selection.
    const templateFiles = fs.listSync(rootPath);
    if (!templateFiles || templateFiles.length === 0) {
      const message = 'Unable to find device model files in the folder.';
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

    const templatePath = path.join(rootPath, fileSelection.label);

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
        {label: 'General', description: ''}
      ];
      const targetSelection = await vscode.window.showQuickPick(
          targetItems,
          {ignoreFocusOut: true, placeHolder: 'Please select a target:'});

      if (!targetSelection) {
        return false;
      }

      if (targetSelection.label === 'MXChip IoT DevKit') {
        const path = await this.GetFolderForCodeGen(channel);
        if (path !== null) {
          await this.GenerateCppCodeForDevKit(
              context, path, templatePath, channel, telemetryContext);
        }
      } else if (targetSelection.label === 'General') {
        const path = await this.GetFolderForCodeGen(channel);
        if (path !== null) {
          await this.GenerateCppCode(path, templatePath, channel);
        }
      }
    }
    vscode.window.showInformationMessage('Scaffold device code stub completed');
    return true;
  }

  async GenerateCppCodeForDevKit(
      context: vscode.ExtensionContext, rootPath: string,
      templateFilePath: string, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    const needReload = false;

    // Create the device path
    const devicePath = path.join(rootPath, constants.deviceDefaultFolderName);

    if (!fs.existsSync(devicePath)) {
      fs.mkdirSync(devicePath);
    }

    // create the path for src. In Arduino, only files under src folder are
    // compiled together with sketch file.
    const sourcePath = path.join(devicePath, 'src');
    if (!fs.existsSync(sourcePath)) {
      fs.mkdirSync(sourcePath);
    }

    // Generate the folder for the code stub
    const fileName = path.basename(templateFilePath);
    // myinterface.template.json => myinterface

    const matchItems = fileName.match(/^(.*?)\.(interface|template)\.json$/);
    if (!matchItems || !matchItems[1]) {
      return false;
    }
    const libPath =
        path.join(sourcePath, matchItems[1]);  // Template or interface name
    if (!fs.existsSync(libPath)) {
      fs.mkdirSync(libPath);
    }

    // Invoke PnP toolset to generate the code
    await this.GenerateCppCode(libPath, templateFilePath, channel);

    // TODO: update the telemetry
    const project: IoTProject =
        new IoTProject(context, channel, telemetryContext);

    // Template select
    const template = context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, AZ3166Device.boardId,
        FileNames.templateFileName));
    const templateJson = require(template);
    const result = templateJson.templates.find((template: ProjectTemplate) => {
      return template.label === 'Device only';  // For the generated project, we
                                                // use the template of device
                                                // only
    });

    await project.create(rootPath, result, AZ3166Device.boardId, true);
    return;
  }

  async GetFolderForCodeGen(channel: vscode.OutputChannel):
      Promise<string|null> {
    let rootPath: string;
    // Ask user to select a folder to export
    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      openLabel: 'Select a folder',
      canSelectFolders: true,
      canSelectFiles: false
    };

    const folderUri = await vscode.window.showOpenDialog(options);
    if (folderUri && folderUri[0]) {
      console.log(`Selected folder: ${folderUri[0].fsPath}`);
      rootPath = folderUri[0].fsPath;

      // if the selected folder is not empty, ask user to select another one.
      const files = fs.readdirSync(rootPath);
      if (files && files[0]) {
        const message =
            'An empty folder is required for the operation. Please use an empty folder.';
        vscode.window.showWarningMessage(message);
        return null;
      }
      return rootPath;
    }
    return null;
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