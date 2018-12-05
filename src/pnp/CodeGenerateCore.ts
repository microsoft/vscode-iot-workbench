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
import {TelemetryContext} from '../telemetry';
import {PnPConnector} from './PnPConnector';
import {PnPConstants, CodeGenConstants} from './PnPConstants';
import {MetaModelType} from './pnp-api/DataContracts/PnPContext';
import {CppCodeGeneratorFactory} from './pnp-codeGen/CppCodeGeneratorFactory';
import {CodeGenDeviceType} from './pnp-codeGen/Interfaces/CodeGenerator';
import {AnsiCCodeGeneratorFactory} from './pnp-codeGen/AnsiCCodeGeneratorFactory';
import {CodeGeneratorFactory} from './pnp-codeGen/Interfaces/CodeGeneratorFactory';


export interface CodeGeneratorConfig {
  version: string;
  win32Md5: string;
  win32PackageUrl: string;
  macOSMd5: string;
  macOSPackageUrl: string;
}

export class CodeGenerateCore {
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

    const upgradestate: boolean =
        await this.UpgradeCodeGenerator(context, channel);

    if (!upgradestate) {
      channel.appendLine(
          'Unable to upgrade the Code Generator to the latest version.\r\n Trying to use the existing version.');
    }

    // Step 1: list all files from device model folder for selection.
    const pnpFiles = fs.listSync(rootPath);
    if (!pnpFiles || pnpFiles.length === 0) {
      const message = 'Unable to find device model files in the folder.';
      vscode.window.showWarningMessage(message);
      return false;
    }

    const pnpItems: vscode.QuickPickItem[] = [];
    pnpFiles.forEach((filePath: string) => {
      const fileName = path.basename(filePath);
      if (fileName.endsWith(PnPConstants.capabilityModelSuffix)) {
        pnpItems.push({label: fileName, description: ''});
      }
    });

    const fileSelection = await vscode.window.showQuickPick(pnpItems, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: 'Select a Plug & Play capability model file',
    });

    if (!fileSelection) {
      return;
    }

    const matchItems =
        fileSelection.label.match(/^(.*?)\.(capabilitymodel)\.json$/);
    if (!matchItems || !matchItems[1]) {
      return false;
    }
    const fileCoreName = matchItems[1];

    const selectedFilePath = path.join(rootPath, fileSelection.label);
    let metaModelType: MetaModelType = MetaModelType.Interface;

    if (fileSelection.label.endsWith(PnPConstants.capabilityModelSuffix)) {
      metaModelType = MetaModelType.CapabilityModel;
    }

    // Get the connection string of the pnp repo
    let connectionString =
        context.workspaceState.get<string>(PnPConstants.modelRepositoryKeyName);

    if (!connectionString) {
      const option: vscode.InputBoxOptions = {
        value: PnPConstants.repoConnectionStringTemplate,
        prompt:
            `Please input the connection string to access the model repository.`,
        ignoreFocusOut: true
      };

      connectionString = await vscode.window.showInputBox(option);

      if (!connectionString) {
        return false;
      } else {
        const result = await PnPConnector.ConnectMetamodelRepository(
            context, connectionString);
        if (!result) {
          return false;
        }
      }
    }

    // select the target of the code stub
    const languageItems: vscode.QuickPickItem[] =
        [{label: 'C++', description: ''}, {label: 'ANSI C', description: ''}];
    const languageSelection = await vscode.window.showQuickPick(
        languageItems,
        {ignoreFocusOut: true, placeHolder: 'Please select a language:'});

    if (!languageSelection) {
      return false;
    }

    let codeGenFactory: CodeGeneratorFactory|null = null;
    let targetItems: vscode.QuickPickItem[]|null = null;

    if (languageSelection.label === 'C++') {
      codeGenFactory =
          new CppCodeGeneratorFactory(context, channel, telemetryContext);
      targetItems = [
        {label: 'MXChip IoT DevKit', description: ''},
        {label: 'General Platform', description: ''}
      ];
    } else if (languageSelection.label === 'ANSI C') {
      codeGenFactory =
          new AnsiCCodeGeneratorFactory(context, channel, telemetryContext);
      targetItems = [
        {label: 'MXChip IoT DevKit', description: ''},
        {label: 'General Platform', description: ''}
      ];
    }

    if (!targetItems || !codeGenFactory) {
      return false;
    }

    const targetSelection = await vscode.window.showQuickPick(
        targetItems,
        {ignoreFocusOut: true, placeHolder: 'Please select a target:'});

    if (!targetSelection) {
      return false;
    }

    const folderPath = await this.GetFolderForCodeGen();
    if (!folderPath) {
      return false;
    }
    let codeGenDeviceType = CodeGenDeviceType.General;
    if (targetSelection.label === 'MXChip IoT DevKit') {
      codeGenDeviceType = CodeGenDeviceType.IoTDevKit;
    }
    const codeGenerator =
        codeGenFactory.CreateCodeGeneratorImpl(codeGenDeviceType);
    if (!codeGenerator) {
      return false;
    }
    const result = await codeGenerator.GenerateCode(
        folderPath, selectedFilePath, fileCoreName, connectionString);
    if (result) {
      vscode.window.showInformationMessage(
          `Scaffold device code for ${targetSelection.label} completed`);
      return true;
    }

    return false;
  }

  async GetFolderForCodeGen(): Promise<string|null> {
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

  async UpgradeCodeGenerator(
      context: vscode.ExtensionContext,
      channel: vscode.OutputChannel): Promise<boolean> {
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

    const codeGenCommandPath =
        path.join(homeDir, CodeGenConstants.codeGeneratorToolPath);

    // Can we find the target dir for PnP Code Generator?
    if (!fs.isDirectorySync(codeGenCommandPath)) {
      needUpgrade = true;
    } else {
      // Then check the version
      const currentVersion =
          context.globalState.get(CodeGenConstants.codeGeneratorVersionKey, '');
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
            CodeGenConstants.codeGeneratorVersionKey, pnpCodeGenConfig.version);
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