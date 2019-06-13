// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as os from 'os';
import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';
import * as crypto from 'crypto';

import request = require('request-promise');
import {FileNames, ConfigKey} from '../constants';
import {TelemetryContext} from '../telemetry';
import {DigitalTwinConnector} from './DigitalTwinConnector';
import {DigitalTwinConstants, CodeGenConstants} from './DigitalTwinConstants';
import {CodeGenProjectType, DeviceConnectionType} from './DigitalTwinCodeGen/Interfaces/CodeGenerator';
import {AnsiCCodeGeneratorFactory} from './DigitalTwinCodeGen/AnsiCCodeGeneratorFactory';
import {ConfigHandler} from '../configHandler';
import {DialogResponses} from '../DialogResponses';
import extractzip = require('extract-zip');
import * as utils from '../utils';


interface CodeGeneratorDownloadLocation {
  win32Md5: string;
  win32PackageUrl: string;
  macOSMd5: string;
  macOSPackageUrl: string;
  ubuntuMd5: string;
  ubuntuPackageUrl: string;
}

const deviceConnectionConstants = {
  connectionStringLabel: 'Via IoT Hub device connection string',
  connectionStringDetail: 'To connect to Azure IoT Hub directly',
  iotcSasKeyLabel: 'Via DPS (Device Provision Service) symmetric key',
  iotcSasKeyDetail:
      'To connect to Azure IoT Hub, Azure IoT Central or Azure IoT Certification Service'
};

interface CodeGeneratorConfigItem {
  codeGeneratorVersion: string;
  iotWorkbenchMinimalVersion: string;
  codeGeneratorLocation: CodeGeneratorDownloadLocation;
}

interface CodeGeneratorConfig {
  codeGeneratorConfigItems: CodeGeneratorConfigItem[];
}

interface CodeGenExecutionInfo {
  filePath: string;
  repoConnectionString: string;
  targetFolder: string;
  languageLabel: string;
  codeGenProjectType: CodeGenProjectType;
  deviceConnectionType: DeviceConnectionType;
}


export class CodeGenerateCore {
  async GenerateDeviceCodeStub(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext): Promise<boolean> {
    const upgradestate: boolean =
        await this.UpgradeCodeGenerator(context, channel);

    if (!upgradestate) {
      channel.appendLine(`${
          DigitalTwinConstants
              .dtPrefix} Unable to upgrade the Code Generator to the latest version.\r\n Trying to use the existing version.`);
    }

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

    // list all capability models from device model folder for selection.
    const metamodelItems: vscode.QuickPickItem[] = [];

    const fileList = fs.listTreeSync(rootPath);
    if (fileList && fileList.length > 0) {
      fileList.forEach((filePath: string) => {
        if (!fs.isDirectorySync(filePath)) {
          const fileName = path.basename(filePath);
          if (fileName.endsWith(DigitalTwinConstants.capabilityModelSuffix)) {
            metamodelItems.push(
                {label: fileName, description: path.dirname(filePath)});
          }
        }
      });
    }

    if (metamodelItems.length === 0) {
      const message =
          'Unable to find capability model files in the folder. Please open a folder that contains capability model files.';
      vscode.window.showWarningMessage(message);
      return false;
    }

    const fileSelection = await vscode.window.showQuickPick(metamodelItems, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder:
          `Select a ${DigitalTwinConstants.productName} capability model file`,
    });

    if (!fileSelection) {
      return false;
    }

    const selectedFilePath =
        path.join(fileSelection.description as string, fileSelection.label);

    // Get the connection string of the IoT Plug and Play repo
    let connectionString =
        ConfigHandler.get<string>(ConfigKey.modelRepositoryKeyName);

    if (!connectionString) {
      const option: vscode.InputBoxOptions = {
        value: DigitalTwinConstants.repoConnectionStringTemplate,
        prompt:
            `Please input the connection string to access the model repository.`,
        ignoreFocusOut: true
      };

      connectionString = await vscode.window.showInputBox(option);

      if (!connectionString) {
        return false;
      } else {
        const result = await DigitalTwinConnector.ConnectMetamodelRepository(
            connectionString);
        if (!result) {
          return false;
        }
      }
    }

    // select the target of the code stub
    const languageItems: vscode.QuickPickItem[] =
        [{label: 'ANSI C', description: ''}];
    const languageSelection = await vscode.window.showQuickPick(
        languageItems,
        {ignoreFocusOut: true, placeHolder: 'Please select a language:'});

    if (!languageSelection) {
      return false;
    }


    let targetItems: vscode.QuickPickItem[]|null = null;

    if (languageSelection.label === 'ANSI C') {
      targetItems = [
        {
          label: 'CMake Project',
          detail:
              'Generate device agnostic standard ANSI C code to integrate into existing device project.'
        },
        {
          label: 'Visual Studio Project',
          detail:
              'Generate device agnostic standard ANSI C code for Visual Studio project.'
        },
        {
          label: 'MXChip IoT DevKit Project',
          detail: 'Generate Arduino project for MXChip IoT DevKit'
        }
      ];
    }

    if (!targetItems) {
      return false;
    }

    const targetSelection = await vscode.window.showQuickPick(
        targetItems,
        {ignoreFocusOut: true, placeHolder: 'Please select a target:'});

    if (!targetSelection) {
      return false;
    }

    let codeGenProjectType = CodeGenProjectType.CMake;
    if (targetSelection.label === 'MXChip IoT DevKit Project') {
      codeGenProjectType = CodeGenProjectType.IoTDevKit;
    } else if (targetSelection.label === 'Visual Studio Project') {
      codeGenProjectType = CodeGenProjectType.VisualStudio;
    }

    let connectionType = DeviceConnectionType.DeviceConnectionString;
    let deviceConnectionSelections: vscode.QuickPickItem[]|null = null;
    deviceConnectionSelections = [
      {
        label: deviceConnectionConstants.connectionStringLabel,
        detail: deviceConnectionConstants.connectionStringDetail
      },
      {
        label: deviceConnectionConstants.iotcSasKeyLabel,
        detail: deviceConnectionConstants.iotcSasKeyDetail
      }
    ];

    const deviceConnectionSelection =
        await vscode.window.showQuickPick(deviceConnectionSelections, {
          ignoreFocusOut: true,
          placeHolder:
              'Please specify how will the device connect to Azure IoT?'
        });

    if (!deviceConnectionSelection) {
      return false;
    }

    if (deviceConnectionSelection.label ===
        deviceConnectionConstants.connectionStringLabel) {
      connectionType = DeviceConnectionType.DeviceConnectionString;
    } else if (
        deviceConnectionSelection.label ===
        deviceConnectionConstants.iotcSasKeyLabel) {
      connectionType = DeviceConnectionType.IoTCSasKey;
    }


    const folderPath = await this.GetFolderForCodeGen();
    if (!folderPath) {
      return false;
    }

    const codeGenExecutionInfo: CodeGenExecutionInfo = {
      filePath: selectedFilePath,
      repoConnectionString: connectionString,
      targetFolder: folderPath,
      languageLabel: 'ANSI C',
      codeGenProjectType,
      deviceConnectionType: connectionType
    };

    const executionResult = await this.GenerateDeviceCodeCore(
        codeGenExecutionInfo, context, channel, telemetryContext);
    await ConfigHandler.update(
        ConfigKey.codeGeneratorExecutionInfo,
        JSON.stringify(codeGenExecutionInfo),
        vscode.ConfigurationTarget.Workspace);
    return executionResult;
  }

  async RegenerateDeviceCodeStub(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext): Promise<boolean> {
    const upgradestate: boolean =
        await this.UpgradeCodeGenerator(context, channel);
    if (!upgradestate) {
      channel.appendLine(`${
          DigitalTwinConstants
              .dtPrefix} Unable to upgrade the Code Generator to the latest version.\r\n Trying to use the existing version.`);
    }

    const executionInfo =
        ConfigHandler.get<string>(ConfigKey.codeGeneratorExecutionInfo);

    if (executionInfo) {
      const codeGenExecutionInfo: CodeGenExecutionInfo =
          JSON.parse(executionInfo as string);
      if (codeGenExecutionInfo) {
        // Does the source file exist?
        if (fs.existsSync(codeGenExecutionInfo.filePath)) {
          utils.mkdirRecursivelySync(codeGenExecutionInfo.targetFolder);
          channel.appendLine(`${
              DigitalTwinConstants.dtPrefix} Regenerate Device Code Stub for ${
              codeGenExecutionInfo.filePath} into ${
              codeGenExecutionInfo.targetFolder}. Language: ${
              codeGenExecutionInfo.languageLabel}`);
          const executionResult = await this.GenerateDeviceCodeCore(
              codeGenExecutionInfo, context, channel, telemetryContext);
          return executionResult;
        }
      }
    }
    const messge =
        'Unable to regenerate device code due to configuration change, would you like to generate device code again?';
    const choice = await vscode.window.showWarningMessage(
        messge, DialogResponses.yes, DialogResponses.no);
    if (choice === DialogResponses.yes) {
      await vscode.commands.executeCommand('iotworkbench.iotPnPGenerateCode');
      return true;
    }
    return false;
  }

  async GenerateDeviceCodeCore(
      codeGenExecutionInfo: CodeGenExecutionInfo,
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext): Promise<boolean> {
    // We only support Ansi C
    const codeGenFactory =
        new AnsiCCodeGeneratorFactory(context, channel, telemetryContext);

    const codeGenerator = codeGenFactory.CreateCodeGeneratorImpl(
        codeGenExecutionInfo.codeGenProjectType,
        codeGenExecutionInfo.deviceConnectionType);
    if (!codeGenerator) {
      return false;
    }

    const fileName = path.basename(codeGenExecutionInfo.filePath);
    const matchItems = fileName.match(/^(.*?)\.(capabilitymodel)\.json$/);

    if (!matchItems || !matchItems[1]) {
      return false;
    }
    const fileCoreName = matchItems[1];

    await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Generate code stub for ${fileCoreName} ...`
        },
        async () => {
          const result = await codeGenerator.GenerateCode(
              codeGenExecutionInfo.targetFolder, codeGenExecutionInfo.filePath,
              fileCoreName, codeGenExecutionInfo.repoConnectionString);
          if (result) {
            vscode.window.showInformationMessage(
                `Generate code stub for ${fileName} completed`);
          }
        });
    return true;
  }

  async GetFolderForCodeGen(): Promise<string|null> {
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
      const rootPath = folderUri[0].fsPath;

      const name = 'iot_application';
      const projectName = await vscode.window.showInputBox({
        value: name,
        prompt: 'Please input project name.',
        ignoreFocusOut: true,
        validateInput: (projectName: string) => {
          if (!/^([a-z0-9_]|[a-z0-9_][-a-z0-9_.]*[a-z0-9_])(\.ino)?$/i.test(
                  projectName)) {
            return 'Project name can only contain letters, numbers, "-" and ".", and cannot start or end with "-" or ".".';
          }
          return;
        }
      });

      const projectPath =
          projectName ? path.join(rootPath, projectName) : undefined;
      if (projectPath) {
        utils.mkdirRecursivelySync(projectPath);
        // if the selected folder is not empty, ask user to select another one.
        const files = fs.readdirSync(projectPath);
        if (files && files[0]) {
          const message = `${
              DigitalTwinConstants
                  .productName} Code Generator would overwrite existing files in the folder ${
              projectName}. Do you want to continue?`;

          const choice = await vscode.window.showInformationMessage(
              message, DialogResponses.yes, DialogResponses.cancel);
          if (choice !== DialogResponses.yes) {
            return null;
          }
        }
        return projectPath;
      }
    }
    return null;
  }

  async UpgradeCodeGenerator(
      context: vscode.ExtensionContext,
      channel: vscode.OutputChannel): Promise<boolean> {
    channel.show();

    const extensionPackage = require(context.asAbsolutePath('./package.json'));
    const extensionVersion = extensionPackage.version;

    // download the config file for code generator
    const options: request.OptionsWithUri = {
      method: 'GET',
      uri: extensionPackage.codeGenConfigUrl,
      encoding: 'utf8',
      json: true
    };

    let targetConfigItem: CodeGeneratorConfigItem|null = null;

    const codeGenConfig: CodeGeneratorConfig = await request(options).promise();
    if (codeGenConfig) {
      codeGenConfig.codeGeneratorConfigItems.sort(
          (configItem1, configItem2) => {
            return compareVersion(
                configItem2.codeGeneratorVersion,
                configItem1.codeGeneratorVersion);  // reverse order
          });

      // if this is a RC build, always use the latest version of code generator.
      if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(extensionVersion)) {
        targetConfigItem = codeGenConfig.codeGeneratorConfigItems[0];
      } else {
        for (const item of codeGenConfig.codeGeneratorConfigItems) {
          if (compareVersion(
                  extensionVersion, item.iotWorkbenchMinimalVersion) >= 0) {
            targetConfigItem = item;
            break;
          }
        }
      }
    }

    if (!targetConfigItem) {
      channel.appendLine(`Unable to get the updated version the ${
          DigitalTwinConstants.productName} Code Generator.`);
      return false;
    }

    // detect version for upgrade
    let needUpgrade = false;
    const platform = os.platform();
    const homeDir = os.homedir();

    const codeGenCommandPath =
        path.join(homeDir, CodeGenConstants.codeGeneratorToolPath);

    // Can we find the target dir for Code Generator?
    if (!fs.isDirectorySync(codeGenCommandPath)) {
      needUpgrade = true;
    } else {
      // Then check the version
      const currentVersion =
          ConfigHandler.get<string>(ConfigKey.codeGeneratorVersion);
      if (!currentVersion ||
          compareVersion(
              targetConfigItem.codeGeneratorVersion, currentVersion) > 0) {
        needUpgrade = true;
      }
    }

    if (needUpgrade) {
      await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title:
                `Upgrade  ${DigitalTwinConstants.productName} Code Generator...`
          },
          async () => {
            channel.appendLine(`Start upgrading ${
                DigitalTwinConstants.productName} Code Generator...`);

            const configItem = targetConfigItem as CodeGeneratorConfigItem;
            let downloadOption: request.OptionsWithUri;
            let md5value: string;
            if (platform === 'win32') {
              downloadOption = {
                method: 'GET',
                uri: configItem.codeGeneratorLocation.win32PackageUrl,
                encoding: null  // Binary data
              };
              md5value = configItem.codeGeneratorLocation.win32Md5;
            } else if (platform === 'darwin') {
              downloadOption = {
                method: 'GET',
                uri: configItem.codeGeneratorLocation.macOSPackageUrl,
                encoding: null  // Binary data
              };
              md5value = configItem.codeGeneratorLocation.macOSMd5;
            } else {
              downloadOption = {
                method: 'GET',
                uri: configItem.codeGeneratorLocation.ubuntuPackageUrl,
                encoding: null  // Binary data
              };
              md5value = configItem.codeGeneratorLocation.ubuntuMd5;
            }

            const loading = setInterval(() => {
              channel.append('.');
            }, 1000);

            try {
              channel.appendLine(`Step 1: Downloading package for ${
                  DigitalTwinConstants.productName} Code Generator...`);
              const zipData = await request(downloadOption).promise();
              const tempPath =
                  path.join(os.tmpdir(), FileNames.iotworkbenchTempFolder);
              const filePath = path.join(tempPath, `${md5value}.zip`);
              fs.writeFileSync(filePath, zipData);
              clearInterval(loading);
              channel.appendLine('Download complete');

              // Validate hash code
              channel.appendLine(
                  'Step 2: Validating hash code for the package...');

              const hashvalue = await fileHash(filePath);
              if (hashvalue !== md5value) {
                throw new Error('Validating hash code failed.');
              } else {
                channel.appendLine('Validating hash code successfully.');
              }

              channel.appendLine(`Step 3: Extracting Azure IoT ${
                  DigitalTwinConstants.productName} Code Generator.`);

              await extract(filePath, codeGenCommandPath);
              channel.appendLine(`${
                  DigitalTwinConstants
                      .productName} Code Generator updated successfully.`);
              await ConfigHandler.update(
                  ConfigKey.codeGeneratorVersion,
                  configItem.codeGeneratorVersion,
                  vscode.ConfigurationTarget.Global);
            } catch (error) {
              clearInterval(loading);
              channel.appendLine('');
              throw error;
            }
          });
      vscode.window.showInformationMessage(`${
          DigitalTwinConstants
              .productName} Code Generator updated successfully`);
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
    if (v1 > v2) return 1;
    if (v1 < v2) return -1;
    i++;
  }
  return 0;
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

async function extract(sourceZip: string, targetFoder: string) {
  return new Promise((resolve, reject) => {
    extractzip(sourceZip, {dir: targetFoder}, (err) => {
      if (err) {
        return reject(err);
      } else {
        return resolve(true);
      }
    });
  });
}