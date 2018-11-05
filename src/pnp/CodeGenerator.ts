// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as os from 'os';
import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';
import * as crypto from 'crypto';

import request = require('request-promise');
import AdmZip = require('adm-zip');
import {FileNames} from '../constants';
import {AZ3166Device} from '../Models/AZ3166Device';
import {IoTProject} from '../Models/IoTProject';
import * as utils from '../utils';
import {TelemetryContext} from '../telemetry';
import {ProjectTemplateType} from '../Models/Interfaces/ProjectTemplate';

export interface CodeGeneratorConfig {
  version: string;
  win32Md5: string;
  win32PackageUrl: string;
  macOSMd5: string;
  macOSPackageUrl: string;
}


const constants = {
  deviceDefaultFolderName: 'Device',
  codeGeneratorPath: 'pnp-codegen',
  codeGeneratorVersionKey: 'pnp/codeGenVersion',
  sketchFileName: 'pnp-device.ino'
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

    const upgradestate: boolean = await this.UpgradeCodeGenerator(
        rootPath, context, channel, telemetryContext);

    if (!upgradestate) {
      channel.appendLine(
          'Unable to upgrade the Code Generator to the latest version.\r\n Trying to use the existing version.');
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

      const path = await this.GetFolderForCodeGen(channel);
      if (!path) {
        return false;
      }

      if (targetSelection.label === 'MXChip IoT DevKit') {
        const result = await this.GenerateCppCodeForDevKit(
            context, path, templatePath, channel, telemetryContext);
        if (result) {
          vscode.window.showInformationMessage(
              'Scaffold device code for MXChip IoT DevKit completed');
          return true;
        }
      } else if (targetSelection.label === 'General') {
        const result = await this.GenerateCppCode(path, templatePath, channel);
        if (result) {
          vscode.window.showInformationMessage(
              'Scaffold general device code completed');
          return true;
        }
      }
    }
    return false;
  }

  async GenerateCppCodeForDevKit(
      context: vscode.ExtensionContext, rootPath: string,
      templateFilePath: string, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext): Promise<boolean> {
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
    const codeGenerateResult =
        await this.GenerateCppCode(libPath, templateFilePath, channel);
    if (!codeGenerateResult) {
      vscode.window.showErrorMessage(
          'Unable to generate code, please check output window for detail.');
      return false;
    }

    // TODO: update the telemetry
    const project: IoTProject =
        new IoTProject(context, channel, telemetryContext);

    const originPath = context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, AZ3166Device.boardId,
        constants.sketchFileName));
    const originalContent = fs.readFileSync(originPath, 'utf8');

    const pathPattern = /{PATHNAME}/g;
    const replaceStr = originalContent.replace(pathPattern, matchItems[1]);

    await project.create(
        rootPath, replaceStr, ProjectTemplateType.Basic, AZ3166Device.boardId,
        true);
    return true;
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
      channel: vscode.OutputChannel): Promise<boolean> {
    // Invoke PnP toolset to generate the code
    const platform = os.platform();
    const homeDir = os.homedir();
    let cmdPath = '';
    if (platform === 'win32' || platform === 'darwin') {
      cmdPath = path.join(homeDir, constants.codeGeneratorPath);
    } else {
      return false;
    }

    const command = `IoTPnP.Cli.exe scaffold  --jsonldUri "${
        templateFilePath}" --language cpp  --output "${targetPath}"`;

    channel.show();
    channel.appendLine('IoT Workbench: scaffold code stub.');
    await utils.runCommand(command, cmdPath, channel);
    channel.appendLine('IoT Workbench: scaffold code stub completed.');
    return true;
  }

  async UpgradeCodeGenerator(
      rootPath: string, context: vscode.ExtensionContext,
      channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext): Promise<boolean> {
    channel.show();

    const extensionPackage = require(context.asAbsolutePath('./package.json'));
    // download the config file for code generator
    const options: request.OptionsWithUri = {
      method: 'GET',
      uri: extensionPackage.codeGenConfigUrl,
      encoding: 'utf8',
      json: true
    };
    const pnpCodeGenConfig: CodeGeneratorConfig =
        await request(options).promise();
    if (!pnpCodeGenConfig) {
      channel.appendLine(
          'Unable to check the updated version the PnP Code Generator.');
      return false;
    }

    // detect version for upgrade
    let needUpgrade = false;
    const platform = os.platform();
    const homeDir = os.homedir();

    const codeGenCommandPath = path.join(homeDir, constants.codeGeneratorPath);

    // Can we find the target dir for PnP Code Generator?
    if (!fs.isDirectorySync(codeGenCommandPath)) {
      needUpgrade = true;
    } else {
      // Then check the version
      const currentVersion =
          context.globalState.get(constants.codeGeneratorVersionKey, '');
      if (!currentVersion ||
          compareVersion(pnpCodeGenConfig.version, currentVersion)) {
        needUpgrade = true;
      }
    }

    if (needUpgrade) {
      channel.appendLine('Start upgrading PnP Code Generator...');

      let downloadOption: request.OptionsWithUri;
      let md5value: string;
      if (platform === 'win32') {
        downloadOption = {
          method: 'GET',
          uri: pnpCodeGenConfig.win32PackageUrl,
          encoding: null  // Binary data
        };
        md5value = pnpCodeGenConfig.win32Md5;
      } else {
        downloadOption = {
          method: 'GET',
          uri: pnpCodeGenConfig.macOSPackageUrl,
          encoding: null  // Binary data
        };
        md5value = pnpCodeGenConfig.macOSMd5;
      }

      const loading = setInterval(() => {
        channel.append('.');
      }, 1000);

      try {
        channel.appendLine('Step 1: Downloading updated PnP Code Generator...');
        const zipData = await request(downloadOption).promise();
        const tempPath =
            path.join(os.tmpdir(), FileNames.iotworkbenchTempFolder);
        const filePath = path.join(tempPath, `${md5value}.zip`);
        fs.writeFileSync(filePath, zipData);
        clearInterval(loading);
        channel.appendLine('Download complete');

        // Validate hash code
        channel.appendLine('Step 2: Validating hash code');

        const hashvalue = await fileHash(filePath);
        if (hashvalue !== md5value) {
          channel.appendLine('Validating hash code failed.');
          return false;
        } else {
          channel.appendLine('Validating hash code successfully.');
        }

        channel.appendLine('Step 3: Extracting PnP Code Generator.');
        const zip = new AdmZip(filePath);

        zip.extractAllTo(codeGenCommandPath, true);
        channel.appendLine('PnP Code Generator updated successfully.');
        context.globalState.update(
            constants.codeGeneratorVersionKey, pnpCodeGenConfig.version);
        return true;
      } catch (error) {
        clearInterval(loading);
        channel.appendLine('');
        throw error;
      }
    }
    // No need to upgrade
    return true;
  }
}

function compareVersion(verion1: string, verion2: string) {
  const ver1 = verion1.split('.');
  const ver2 = verion2.split('.');
  let i = 0;
  let v1: number, v2: number;

  /* default is 0, version format should be 1.1.0 */
  while (i < 3) {
    v1 = Number(ver1[i]);
    v2 = Number(ver2[i]);
    if (v1 > v2) return true;
    if (v1 < v2) return false;
    i++;
  }
  return false;
}

async function fileHash(filename: string, algorithm = 'md5') {
  const hash = crypto.createHash(algorithm);
  const input = fs.createReadStream(filename);
  let hashvalue = '';
  return new Promise((resolve, reject) => {
    input.on('readable', () => {
      const data = input.read();
      if (data) {
        hash.update(data);
      }
    });
    input.on('error', reject);
    input.on('end', () => {
      hashvalue = hash.digest('hex');
      return resolve(hashvalue);
    });
  });
}