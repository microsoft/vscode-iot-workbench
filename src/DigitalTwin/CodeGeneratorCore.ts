// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as os from 'os';
import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';
import * as crypto from 'crypto';

import request = require('request-promise');
import extractzip = require('extract-zip');

import * as utils from '../utils';
import {FileNames, ConfigKey, GlobalConstants} from '../constants';
import {TelemetryContext} from '../telemetry';
import {DigitalTwinConstants} from './DigitalTwinConstants';
import {CodeGenProjectType, DeviceConnectionType, CodeGenLanguage, DeviceSdkReferenceType, CodeGenExecutionItem} from './DigitalTwinCodeGen/Interfaces/CodeGenerator';
import {AnsiCCodeGeneratorFactory} from './DigitalTwinCodeGen/AnsiCCodeGeneratorFactory';
import {ConfigHandler} from '../configHandler';
import {PnpDeviceConnection, CodeGenProjectTemplate, DeviceSdkReference} from '../Models/Interfaces/ProjectTemplate';
import {DialogResponses} from '../DialogResponses';
import {RemoteExtension} from '../Models/RemoteExtension';
import {DigitalTwinUtility} from './DigitalTwinUtility';

interface CodeGeneratorDownloadLocation {
  win32Md5: string;
  win32PackageUrl: string;
  macOSMd5: string;
  macOSPackageUrl: string;
  ubuntuMd5: string;
  ubuntuPackageUrl: string;
}

interface CodeGeneratorConfigItem {
  codeGeneratorVersion: string;
  iotWorkbenchMinimalVersion: string;
  codeGeneratorLocation: CodeGeneratorDownloadLocation;
}

interface CodeGeneratorConfig {
  codeGeneratorConfigItems: CodeGeneratorConfigItem[];
}

interface CodeGenExecutions {
  codeGenExecutionItems: CodeGenExecutionItem[];
}

enum ReGenResult {
  Cancelled,
  Succeeded,
  Skipped
}

export class CodeGeneratorCore {
  async generateDeviceCodeStub(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    const isLocal = RemoteExtension.checkLocalBeforeRunCommand(context);
    if (!isLocal) {
      return;
    }

    const rootPath = utils.checkOpenedFolder();
    if (!rootPath) {
      return;
    }

    // Check installation of Codegen CLI and update its bits if a new version is
    // found
    if (!await this.installOrUpgradeCodeGenCli(context, channel)) {
      return;
    }

    // Select Capability Model
    if (!DigitalTwinUtility.init(channel)) {
      return;
    }
    const capabilityModelFilePath: string =
        await DigitalTwinUtility.selectCapabilityModel();
    if (!capabilityModelFilePath) {
      return;
    }

    // Prompt if old project exists for the same Capability Model file
    const regenResult = await this.RegenCode(
        rootPath, capabilityModelFilePath, context, channel, telemetryContext);
    if (regenResult === ReGenResult.Succeeded ||
        regenResult === ReGenResult.Cancelled) {
      return;
    }

    // Specify project name
    const codeGenProjectName = await this.getCodeGenProjectName(rootPath);
    if (!codeGenProjectName) {
      const message = `Project name is not specified, cancelled`;
      utils.channelShowAndAppendLine(channel, message);
      return;
    }

    // Select language
    const codeGenLanguage = await this.selectLanguage(telemetryContext);
    if (!codeGenLanguage) {
      return;
    }

    // Read CodeGen options configuration JSON
    const codeGenOptions = this.readCodeGenOptionsConfiguration(context);

    // Select device connection string type
    const connectionType =
        await this.selectConnectionType(codeGenOptions, telemetryContext);
    if (!connectionType) {
      return;
    }

    // Select project template
    const codeGenProjectType = await this.selectProjectTemplate(
        codeGenLanguage, codeGenOptions, telemetryContext);
    if (!codeGenProjectType) {
      return;
    }

    // Select Device SDK reference type for CMake project
    const sdkReferenceType = await this.selectDeviceSdkReferenceType(
        codeGenProjectType, codeGenOptions, telemetryContext);
    if (!sdkReferenceType) {
      return;
    }

    // Download dependent interface of capability model
    if (!await DigitalTwinUtility.downloadDependentInterface(
            rootPath, capabilityModelFilePath)) {
      return;
    }

    const codeGenExecutionInfo: CodeGenExecutionItem = {
      outputDirectory: path.join(rootPath, codeGenProjectName),
      capabilityModelFilePath,
      interfaceDirecoty: rootPath,
      projectName: codeGenProjectName,
      languageLabel: CodeGenLanguage.ANSIC,
      codeGenProjectType,
      deviceSdkReferenceType: sdkReferenceType,
      deviceConnectionType: connectionType
    };

    this.saveCodeGenConfig(
        rootPath, capabilityModelFilePath, codeGenExecutionInfo);

    await this.generateDeviceCodeCore(
        codeGenExecutionInfo, context, channel, telemetryContext);
  }

  private async RegenCode(
      rootPath: string, capabilityModelFilePath: string,
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext): Promise<ReGenResult> {
    const codeGenConfigPath = path.join(
        rootPath, FileNames.vscodeSettingsFolderName,
        DigitalTwinConstants.codeGenConfigFileName);

    let codeGenExecutionItem: CodeGenExecutionItem|undefined;

    // CodeGen configuration file not found, no need to regenerate code
    if (!fs.existsSync(codeGenConfigPath)) {
      return ReGenResult.Skipped;
    }

    try {
      const codeGenExecutions: CodeGenExecutions =
          JSON.parse(fs.readFileSync(codeGenConfigPath, 'utf8'));
      if (codeGenExecutions) {
        codeGenExecutionItem = codeGenExecutions.codeGenExecutionItems.find(
            item => item.capabilityModelFilePath === capabilityModelFilePath);
      }
    } catch {
      // just skip this if read file failed.
    }

    if (codeGenExecutionItem) {
      const regenOptions: vscode.QuickPickItem[] = [];
      // select the target of the code stub
      regenOptions.push(
          {
            label: `Re-generate code for ${codeGenExecutionItem.projectName}`,
            description: ''
          },
          {label: 'Create new project', description: ''});

      const regenSelection = await vscode.window.showQuickPick(
          regenOptions,
          {ignoreFocusOut: true, placeHolder: 'Please select an option:'});

      if (!regenSelection) {
        telemetryContext.properties.errorMessage =
            'Re-generate code selection cancelled.';
        telemetryContext.properties.result = 'Cancelled';
        return ReGenResult.Succeeded;
      }

      // User select regenerate code
      if (regenSelection.label !== 'Create new project') {
        if (!await DigitalTwinUtility.downloadDependentInterface(
                rootPath, capabilityModelFilePath)) {
          return ReGenResult.Skipped;
        }

        await this.generateDeviceCodeCore(
            codeGenExecutionItem, context, channel, telemetryContext);
        return ReGenResult.Succeeded;
      } else {
        return ReGenResult.Skipped;
      }
    } else {
      return ReGenResult.Skipped;
    }
  }

  private async getCodeGenProjectName(rootPath: string):
      Promise<string|undefined> {
    // select the project name for code gen
    const codeGenProjectName = await vscode.window.showInputBox({
      placeHolder: 'Please input the project name here.',
      ignoreFocusOut: true,
      validateInput: (projectName: string) => {
        if (!projectName || projectName.length === 0) {
          return `The project name can't be empty.`;
        }
        if (!DigitalTwinConstants.codegenProjectNameRegex.test(projectName)) {
          return `Project name can only contain ${
              DigitalTwinConstants.codegenProjectNameRegexDescription}.`;
        }
        return;
      }
    });

    if (!codeGenProjectName) {
      return;
    }

    const projectPath = path.join(rootPath, codeGenProjectName);

    if (fs.isDirectorySync(projectPath)) {
      const messge = `The folder ${
          projectPath} already exists. Do you want to overwrite the contents in this folder?`;
      const choice = await vscode.window.showWarningMessage(
          messge, DialogResponses.yes, DialogResponses.no);
      if (choice === DialogResponses.yes) {
        return codeGenProjectName;
      } else {
        return;
      }
    }
    return codeGenProjectName;
  }

  private readCodeGenOptionsConfiguration(
      // tslint:disable-next-line: no-any
      context: vscode.ExtensionContext): any {
    // Load CodeGen configuration file which defines the available CodeGen
    // options in VS Code command palette
    const codeGenConfigFilePath: string = context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName,
        FileNames.codeGenOptionsFileName));
    return JSON.parse(fs.readFileSync(codeGenConfigFilePath, 'utf8'));
  }

  private async selectLanguage(telemetryContext: TelemetryContext):
      Promise<string|undefined> {
    const languageItems: vscode.QuickPickItem[] = [];
    languageItems.push({label: CodeGenLanguage.ANSIC, description: ''});

    const languageSelection = await vscode.window.showQuickPick(languageItems, {
      ignoreFocusOut: true,
      placeHolder: 'Select the language for generated code:'
    });

    if (!languageSelection) {
      telemetryContext.properties.errorMessage =
          'CodeGen language selection cancelled.';
      telemetryContext.properties.result = 'Cancelled';
      return;
    }

    return languageSelection.label;
  }

  private async selectConnectionType(
      // tslint:disable-next-line: no-any
      codegenOptionsConfig: any, telemetryContext: TelemetryContext):
      Promise<DeviceConnectionType|undefined> {
    // Load available Azure IoT connection types from JSON configuration
    const connectionTypeItems: vscode.QuickPickItem[] = [];
    codegenOptionsConfig.connectionTypes.forEach(
        (element: PnpDeviceConnection) => {
          connectionTypeItems.push(
              {label: element.name, detail: element.detail});
        });

    const deviceConnectionSelection =
        await vscode.window.showQuickPick(connectionTypeItems, {
          ignoreFocusOut: true,
          placeHolder: 'How will device connect to Azure IoT?'
        });

    if (!deviceConnectionSelection) {
      telemetryContext.properties.errorMessage =
          'Connection type selection cancelled.';
      telemetryContext.properties.result = 'Cancelled';
      return;
    }

    const deviceConnection = codegenOptionsConfig.connectionTypes.find(
        (connectionType: PnpDeviceConnection) => {
          return connectionType.name === deviceConnectionSelection.label;
        });

    const connectionType: DeviceConnectionType = DeviceConnectionType
        [deviceConnection.type as keyof typeof DeviceConnectionType];

    if (!connectionType) {
      throw new Error(
          `Failed to find an available device connection type with selection label '${
              deviceConnectionSelection.label}' from CodeGen configuration.`);
    }
    return connectionType;
  }

  private async selectProjectTemplate(
      // tslint:disable-next-line: no-any
      language: string, codegenOptionsConfig: any,
      telemetryContext: TelemetryContext):
      Promise<CodeGenProjectType|undefined> {
    // Load available project templates from JSON configuration
    const projectTemplates = codegenOptionsConfig.projectTemplates.filter(
        (projectTemplate: CodeGenProjectTemplate) => {
          return (
              projectTemplate.enabled && projectTemplate.language === language);
        });

    const projectTemplateItems: vscode.QuickPickItem[] = [];
    projectTemplates.forEach((element: CodeGenProjectTemplate) => {
      projectTemplateItems.push({label: element.name, detail: element.detail});
    });

    if (!projectTemplateItems) {
      throw new Error(
          `Internal error. Unable to find available project templates using ${
              language} language.`);
    }

    const projectTemplateSelection = await vscode.window.showQuickPick(
        projectTemplateItems,
        {ignoreFocusOut: true, placeHolder: 'Select project template:'});

    if (!projectTemplateSelection) {
      telemetryContext.properties.errorMessage =
          'CodeGen project template selection cancelled.';
      telemetryContext.properties.result = 'Cancelled';
      return;
    }

    const projectTemplate =
        projectTemplates.find((projectType: CodeGenProjectTemplate) => {
          return projectType.name === projectTemplateSelection.label;
        });

    const codeGenProjectType: CodeGenProjectType = CodeGenProjectType
        [projectTemplate.type as keyof typeof CodeGenProjectType];

    if (!codeGenProjectType) {
      throw new Error(
          `Failed to find an available project template with selection label '${
              projectTemplateSelection.label}' from CodeGen configuration.`);
    }

    return codeGenProjectType;
  }

  private async selectDeviceSdkReferenceType(
      // tslint:disable-next-line: no-any
      projectType: CodeGenProjectType, codegenOptionsConfig: any,
      telemetryContext: TelemetryContext):
      Promise<DeviceSdkReferenceType|undefined> {
    switch (projectType) {
      case CodeGenProjectType.IoTDevKit:
        return DeviceSdkReferenceType.DevKitSDK;
      case CodeGenProjectType.CMakeWindows:
      case CodeGenProjectType.CMakeLinux: {
        // Load available Azure IoT connection types from JSON configuration
        const sdkReferenceTypeItems: vscode.QuickPickItem[] = [];
        codegenOptionsConfig.deviceSdkReferenceTypes.forEach(
            (element: DeviceSdkReference) => {
              sdkReferenceTypeItems.push(
                  {label: element.name, detail: element.detail});
            });

        const deviceConnectionSelection =
            await vscode.window.showQuickPick(sdkReferenceTypeItems, {
              ignoreFocusOut: true,
              placeHolder: 'How will CMake include the Azure IoT Device SDK?'
            });

        if (!deviceConnectionSelection) {
          telemetryContext.properties.errorMessage =
              'IoT Device SDK reference type selection cancelled.';
          telemetryContext.properties.result = 'Cancelled';
          return;
        }

        // Map selection to a DeviceSdkReferenceType enum
        const sdkReference = codegenOptionsConfig.deviceSdkReferenceTypes.find(
            (sdkReference: DeviceSdkReference) => {
              return sdkReference.name === deviceConnectionSelection.label;
            });

        const sdkReferenceType: DeviceSdkReferenceType = DeviceSdkReferenceType
            [sdkReference.type as keyof typeof DeviceSdkReferenceType];

        if (!sdkReference) {
          throw new Error(
              `Failed to find an available SDK reference type with selection label '${
                  deviceConnectionSelection
                      .label}' from CodeGen configuration.`);
        }

        return sdkReferenceType;
      }
      default:
        return;
    }
  }

  private async generateDeviceCodeCore(
      codeGenExecutionInfo: CodeGenExecutionItem,
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext): Promise<boolean> {
    // We only support Ansi C
    const codeGenFactory =
        new AnsiCCodeGeneratorFactory(context, channel, telemetryContext);

    const codeGenerator = codeGenFactory.createCodeGeneratorImpl(
        codeGenExecutionInfo.languageLabel);
    if (!codeGenerator) {
      return false;
    }

    // Parse capabilityModel name from id
    const capabilityModel = JSON.parse(
        fs.readFileSync(codeGenExecutionInfo.capabilityModelFilePath, 'utf8'));
    const capabilityModelId = capabilityModel['@id'];

    await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Generate PnP device code for ${capabilityModelId} ...`
        },
        async () => {
          const result = await codeGenerator.generateCode(codeGenExecutionInfo);
          if (result) {
            vscode.window.showInformationMessage(
                `Generate PnP device code for ${capabilityModelId} completed`);
          }
        });
    return true;
  }

  private saveCodeGenConfig(
      rootPath: string, capabilityModelFilePath: string,
      codeGenExecutionInfo: CodeGenExecutionItem): void {
    const codeGenConfigPath = path.join(
        rootPath, FileNames.vscodeSettingsFolderName,
        DigitalTwinConstants.codeGenConfigFileName);

    try {
      if (fs.existsSync(codeGenConfigPath)) {
        const codeGenExecutions: CodeGenExecutions =
            JSON.parse(fs.readFileSync(codeGenConfigPath, 'utf8'));

        if (codeGenExecutions) {
          codeGenExecutions.codeGenExecutionItems =
              codeGenExecutions.codeGenExecutionItems.filter(
                  item =>
                      item.capabilityModelFilePath !== capabilityModelFilePath);
          codeGenExecutions.codeGenExecutionItems.push(codeGenExecutionInfo);
          fs.writeFileSync(
              codeGenConfigPath,
              JSON.stringify(
                  codeGenExecutions, null, GlobalConstants.indentationSpace));
        }
      } else {
        const codeGenExecutions:
            CodeGenExecutions = {codeGenExecutionItems: [codeGenExecutionInfo]};
        fs.writeFileSync(
            codeGenConfigPath,
            JSON.stringify(
                codeGenExecutions, null, GlobalConstants.indentationSpace));
      }
    } catch (error) {
      // save config failure should not impact code gen.
      console.log(error);
    }
  }

  private async getCodeGenCliPackageInfo(
      context: vscode.ExtensionContext,
      channel: vscode.OutputChannel): Promise<CodeGeneratorConfigItem|null> {
    const extensionPackage = require(context.asAbsolutePath('./package.json'));
    const extensionVersion = extensionPackage.version;

    // Download the config file for CodeGen cli
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
      const message = `${
          DigitalTwinConstants
              .dtPrefix} Failed to get download information for ${
          DigitalTwinConstants.codeGenCli}.`;
      utils.channelShowAndAppendLine(channel, message);
    }

    return targetConfigItem;
  }

  private async checkLocalCodeGenCli(): Promise<string|null> {
    // Check version of existing CodeGen Cli
    const platform = os.platform();
    const currentVersion =
        ConfigHandler.get<string>(ConfigKey.codeGeneratorVersion);
    let codeGenCliAppPath =
        path.join(localCodeGenCliPath(), DigitalTwinConstants.codeGenCliApp);
    if (platform === 'win32') {
      codeGenCliAppPath += '.exe';
    }

    if (!fs.isFileSync(codeGenCliAppPath) || currentVersion == null) {
      // Doen't exist
      return null;
    }
    // TODO: should check the integrity of the CodeGen Cli
    return currentVersion;
  }

  private async downloadAndInstallCodeGenCli(
      channel: vscode.OutputChannel, targetConfigItem: CodeGeneratorConfigItem,
      installOrUpgrade: number, newVersion: string): Promise<boolean> {
    let packageUri: string;
    let md5value: string;
    const platform = os.platform();
    if (platform === 'win32') {
      packageUri = targetConfigItem.codeGeneratorLocation.win32PackageUrl;
      md5value = targetConfigItem.codeGeneratorLocation.win32Md5;
    } else if (platform === 'darwin') {
      packageUri = targetConfigItem.codeGeneratorLocation.macOSPackageUrl;
      md5value = targetConfigItem.codeGeneratorLocation.macOSMd5;
    } else {
      packageUri = targetConfigItem.codeGeneratorLocation.ubuntuPackageUrl;
      md5value = targetConfigItem.codeGeneratorLocation.ubuntuMd5;
    }

    const loading = setInterval(() => {
      channel.append('.');
    }, 1000);

    try {
      // Download
      utils.channelShowAndAppend(
          channel,
          `Step 1: Downloading ${DigitalTwinConstants.codeGenCli} v${
              newVersion} package ...`);
      const downloadOption: request
          .OptionsWithUri = {method: 'GET', uri: packageUri, encoding: null};
      const zipData = await request(downloadOption).promise();
      const tempPath = path.join(os.tmpdir(), FileNames.iotworkbenchTempFolder);
      const filePath = path.join(tempPath, `${md5value}.zip`);
      fs.writeFileSync(filePath, zipData);
      clearInterval(loading);
      utils.channelShowAndAppendLine(channel, ' download complete.');

      // Verify
      // Validate hash code
      utils.channelShowAndAppend(
          channel, 'Step 2: Validating hash code for the package ...');
      const hashvalue = await fileHash(filePath);
      if (hashvalue !== md5value) {
        utils.channelShowAndAppendLine(
            channel,
            `the downloaded ${DigitalTwinConstants.codeGenCli} v${
                newVersion} package has been corrupted.`);
        if (installOrUpgrade === 1) {
          utils.channelShowAndAppendLine(
              channel,
              `${
                  DigitalTwinConstants
                      .dtPrefix} Abort generating device code stub.`);
          return false;
        } else {
          utils.channelShowAndAppendLine(
              channel,
              `        Abort the installation and continue generating device code stub.`);
          return true;
        }
      } else {
        utils.channelShowAndAppendLine(channel, ' passed.');
      }

      // Extract files
      const codeGenCommandPath = localCodeGenCliPath();
      utils.channelShowAndAppend(channel, `Step 3: Extracting files ...`);
      await extract(filePath, codeGenCommandPath);
      utils.channelShowAndAppendLine(channel, ' done.');
      // Update the config
      await ConfigHandler.update(
          ConfigKey.codeGeneratorVersion, newVersion,
          vscode.ConfigurationTarget.Global);
    } finally {
      clearInterval(loading);
    }

    utils.channelShowAndAppendLine(
        channel,
        `${DigitalTwinConstants.dtPrefix} The ${
            DigitalTwinConstants.codeGenCli} v${newVersion} is ready to use.`);
    return true;
  }

  private async installOrUpgradeCodeGenCli(
      context: vscode.ExtensionContext,
      channel: vscode.OutputChannel): Promise<boolean> {
    utils.channelShowAndAppend(
        channel,
        `${DigitalTwinConstants.dtPrefix} Check ${
            DigitalTwinConstants.codeGenCli} ...`);
    const targetConfigItem =
        await this.getCodeGenCliPackageInfo(context, channel);
    if (targetConfigItem === null) {
      return false;
    }

    // Check version of existing CodeGen Cli
    let installOrUpgrade = 0;
    const currentVersion = await this.checkLocalCodeGenCli();
    if (currentVersion == null) {
      installOrUpgrade = 1;
    } else {
      // Compare version
      if (compareVersion(
              targetConfigItem.codeGeneratorVersion, currentVersion) > 0) {
        // Upgrade
        installOrUpgrade = 2;
      }
    }
    if (installOrUpgrade === 0) {
      // Already exists
      utils.channelShowAndAppendLine(
          channel, ` v${currentVersion} is installed and ready to use.`);
      return true;
    }

    const newVersion = targetConfigItem.codeGeneratorVersion;
    const processTitle =
        (installOrUpgrade === 1 ?
             `Installing ${DigitalTwinConstants.codeGenCli} ...` :
             `Upgrading ${DigitalTwinConstants.codeGenCli} ...`);
    const upgradeMessage =
        (installOrUpgrade === 1 ?
             ` not installed, start installing :` :
             ` new version detected, start upgrading from ${
                 currentVersion} to ${newVersion} :`);
    utils.channelShowAndAppendLine(channel, upgradeMessage);

    // Start donwloading
    let result = false;
    await vscode.window.withProgress(
        {location: vscode.ProgressLocation.Notification, title: processTitle},
        async () => {
          result = await this.downloadAndInstallCodeGenCli(
              channel, targetConfigItem as CodeGeneratorConfigItem,
              installOrUpgrade, newVersion);
        });

    return result;
  }
}

function localCodeGenCliPath(): string {
  return path.join(os.homedir(), DigitalTwinConstants.codeGenCliFolder);
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
    extractzip(sourceZip, {dir: targetFoder}, err => {
      if (err) {
        return reject(err);
      } else {
        return resolve(true);
      }
    });
  });
}
