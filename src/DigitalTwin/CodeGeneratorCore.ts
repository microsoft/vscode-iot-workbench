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
import * as dtUtils from './Utilities';
import {FileNames, ConfigKey} from '../constants';
import {TelemetryContext} from '../telemetry';
import {DigitalTwinConstants, CodeGenConstants, DigitalTwinFileNames} from './DigitalTwinConstants';
import {CodeGenProjectType, DeviceConnectionType, PnpLanguage} from './DigitalTwinCodeGen/Interfaces/CodeGenerator';
import {AnsiCCodeGeneratorFactory} from './DigitalTwinCodeGen/AnsiCCodeGeneratorFactory';
import {ConfigHandler} from '../configHandler';
import {DigitalTwinMetamodelRepositoryClient} from './DigitalTwinApi/DigitalTwinMetamodelRepositoryClient';
import {DigitalTwinConnectionStringBuilder} from './DigitalTwinApi/DigitalTwinConnectionStringBuilder';
import {PnpProjectTemplateType, ProjectTemplate, PnpDeviceConnectionType} from '../Models/Interfaces/ProjectTemplate';
import {DialogResponses} from '../DialogResponses';
import {CredentialStore} from '../credentialStore';
import {RemoteExtension} from '../Models/RemoteExtension';

const constants = {
  codeGenConfigFileName: '.codeGenConfigs',
  defaultAppName: 'iot_application'
};

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

interface CodeGenExecutionItem {
  capabilityModelPath: string;  // relative path of the Capability Model file
  projectName: string;
  languageLabel: string;
  codeGenProjectType: CodeGenProjectType;
  deviceConnectionType: DeviceConnectionType;
}

interface CodeGenExecutions {
  codeGenExecutionItems: CodeGenExecutionItem[];
}

export class CodeGeneratorCore {
  async generateDeviceCodeStub(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext): Promise<boolean> {
    const notRemote = RemoteExtension.checkNotRemoteBeforeRunCommand(context);
    if (!notRemote) {
      return true;
    }

    // Step 0: update code generator
    if (!await this.installOrUpgradeCodeGenCli(context, channel)) {
      return false;
    }

    if (!vscode.workspace.workspaceFolders) {
      const message =
          'No folder is currently open in Visual Studio Code. Please select a folder first.';
      vscode.window.showWarningMessage(message);
      return false;
    }

    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    if (!rootPath) {
      const message =
          'Unable to find the folder for device model files. Please select a folder first.';
      vscode.window.showWarningMessage(message);
      return false;
    }

    // Retrieve all schema files
    const interfaceFiles: dtUtils.SchemaFileInfo[] = [];
    const dcmFiles: dtUtils.SchemaFileInfo[] = [];
    dtUtils.listAllPnPSchemaFilesSync(rootPath, dcmFiles, interfaceFiles);

    // Step 1: Choose Capability Model
    const capabilityModelFileSelection =
        await this.selectCapabilityFile(channel, dcmFiles, telemetryContext);
    if (capabilityModelFileSelection === undefined) {
      utils.channelShowAndAppendLine(
          channel, `${DigitalTwinConstants.dtPrefix} Cancelled.`);
      return false;
    }

    // Step 1.5: Prompt if old project exists for the same Capability Model file
    const capabilityModelFileName = capabilityModelFileSelection.label;
    const capabilityModelFilePath = path.join(
        capabilityModelFileSelection.description as string,
        capabilityModelFileName);
    const capabilityModelPath =
        path.relative(rootPath, capabilityModelFilePath);

    const codeGenConfigPath = path.join(
        rootPath, FileNames.vscodeSettingsFolderName,
        constants.codeGenConfigFileName);

    let codeGenExecutionItem: CodeGenExecutionItem|undefined;
    if (fs.existsSync(codeGenConfigPath)) {
      try {
        const codeGenExecutions: CodeGenExecutions =
            JSON.parse(fs.readFileSync(codeGenConfigPath, 'utf8'));
        if (codeGenExecutions) {
          codeGenExecutionItem = codeGenExecutions.codeGenExecutionItems.find(
              item => item.capabilityModelPath === capabilityModelPath);
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
          return false;
        }

        if (regenSelection.label !== 'Create new project') {
          // Regen code
          const projectPath =
              path.join(rootPath, codeGenExecutionItem.projectName);
          if (!await this.downloadAllIntefaceFiles(
                  channel, rootPath, capabilityModelFilePath, projectPath,
                  interfaceFiles)) {
            return false;
          }
          const executionResult = await this.generateDeviceCodeCore(
              rootPath, codeGenExecutionItem, context, channel,
              telemetryContext);
          return executionResult;
        }
      }
    }

    // Step 2: Get project name
    const codeGenProjectName = await this.getCodeGenProjectName(rootPath);
    if (codeGenProjectName === undefined) {
      const message = `Project name is not specified, cancelled`;
      utils.channelShowAndAppendLine(channel, message);
      return false;
    }

    const projectPath = path.join(rootPath, codeGenProjectName);

    // Step 3: Select language
    const languageItems: vscode.QuickPickItem[] = [];
    languageItems.push({label: PnpLanguage.ANSIC, description: ''});

    const languageSelection = await vscode.window.showQuickPick(
        languageItems,
        {ignoreFocusOut: true, placeHolder: 'Please select a language:'});

    if (!languageSelection) {
      telemetryContext.properties.errorMessage =
          'Language selection cancelled.';
      telemetryContext.properties.result = 'Cancelled';
      return false;
    }

    // Step 4: Select project type
    const codeGenProjectType = await this.selectProjectType(
        languageSelection.label, context, telemetryContext);
    if (codeGenProjectType === undefined) {
      return false;
    }

    // Step 5: Select device connection string type
    const connectionType =
        await this.selectConnectionType(context, channel, telemetryContext);
    if (connectionType === undefined) {
      return false;
    }

    // Download all interfaces
    if (!await this.downloadAllIntefaceFiles(
            channel, rootPath, capabilityModelFilePath, projectPath,
            interfaceFiles)) {
      return false;
    }

    const codeGenExecutionInfo: CodeGenExecutionItem = {
      capabilityModelPath,
      projectName: codeGenProjectName,
      languageLabel: 'ANSI C',
      codeGenProjectType,
      deviceConnectionType: connectionType
    };

    try {
      if (fs.existsSync(codeGenConfigPath)) {
        const codeGenExecutions: CodeGenExecutions =
            JSON.parse(fs.readFileSync(codeGenConfigPath, 'utf8'));

        if (codeGenExecutions) {
          codeGenExecutions.codeGenExecutionItems =
              codeGenExecutions.codeGenExecutionItems.filter(
                  item => item.capabilityModelPath !== capabilityModelPath);
          codeGenExecutions.codeGenExecutionItems.push(codeGenExecutionInfo);
          fs.writeFileSync(
              codeGenConfigPath, JSON.stringify(codeGenExecutions, null, 4));
        }
      } else {
        const codeGenExecutions:
            CodeGenExecutions = {codeGenExecutionItems: [codeGenExecutionInfo]};
        fs.writeFileSync(
            codeGenConfigPath, JSON.stringify(codeGenExecutions, null, 4));
      }
    } catch {
      // save config failure should not impact code gen.
    }

    const executionResult = await this.generateDeviceCodeCore(
        rootPath, codeGenExecutionInfo, context, channel, telemetryContext);

    return executionResult;
  }

  private async downloadAllIntefaceFiles(
      channel: vscode.OutputChannel, rootPath: string,
      capabilityModelFilePath: string, projectPath: string,
      interfaceFiles: dtUtils.SchemaFileInfo[]): Promise<boolean> {
    const capabilityModel =
        JSON.parse(fs.readFileSync(capabilityModelFilePath, 'utf8'));

    const implementedInterfaces = capabilityModel['implements'];
    utils.mkdirRecursivelySync(projectPath);

    let connectionString: string|null = null;
    let credentialChecked = false;
    for (const interfaceItem of implementedInterfaces) {
      const schema = interfaceItem.schema;
      if (typeof schema === 'string') {
        // normal Interface, check the Interface file offline and online
        const item = interfaceFiles.find(item => item.id === schema);
        if (!item) {
          if (!credentialChecked) {
            // Get the connection string of the IoT Plug and Play repo
            connectionString = await CredentialStore.getCredential(
                ConfigKey.modelRepositoryKeyName);
          }

          if (connectionString) {
            // Company Model Repo connections already set
            credentialChecked = true;
            // Try company repo first
            if (await this.downloadInterfaceFile(
                    schema, rootPath, connectionString, channel)) {
              // Downloaded from company repo.
              continue;
            }
            // Then try public repo
            if (await this.downloadInterfaceFile(
                    schema, rootPath, null, channel)) {
              // Downloaded from company repo.
              continue;
            }
            // Unknow interface, throw error
            throw new Error(`Can't find the interface ${schema}.`);
          } else {
            // Only can try public repo
            if (await this.downloadInterfaceFile(
                    schema, rootPath, null, channel)) {
              // Downloaded from public repo.
              continue;
            }
            // Throw error and lead user to set the company model repo
            // connection string
            throw new Error(`Can't find the interface: ${
                schema} in local folder, use 'IoT Plug and Play: Open Model Repository' command to connect to the company repository, then try generating the device code again.`);
          }
        }
      }
    }
    return true;
  }

  private async generateDeviceCodeCore(
      rootPath: string, codeGenExecutionInfo: CodeGenExecutionItem,
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext): Promise<boolean> {
    // We only support Ansi C
    const codeGenFactory =
        new AnsiCCodeGeneratorFactory(context, channel, telemetryContext);

    const codeGenerator = codeGenFactory.createCodeGeneratorImpl(
        codeGenExecutionInfo.codeGenProjectType,
        codeGenExecutionInfo.deviceConnectionType);
    if (!codeGenerator) {
      return false;
    }

    // Parse capabilityModel name from id
    const capabilityModel = JSON.parse(fs.readFileSync(
        path.join(rootPath, codeGenExecutionInfo.capabilityModelPath), 'utf8'));

    const capabilityModelId = capabilityModel['@id'];
    const capabilityModelIdStrings = capabilityModelId.split(':');
    const capabilityModelName =
        capabilityModelIdStrings[capabilityModelIdStrings.length - 2];

    await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Generate code stub for ${capabilityModelName} ...`
        },
        async () => {
          const projectPath =
              path.join(rootPath, codeGenExecutionInfo.projectName);
          const capabilityModelFilePath =
              path.join(rootPath, codeGenExecutionInfo.capabilityModelPath);
          const result = await codeGenerator.generateCode(
              projectPath, capabilityModelFilePath, capabilityModelName,
              capabilityModelId, rootPath);
          if (result) {
            vscode.window.showInformationMessage(
                `Generate code stub for ${capabilityModelName} completed`);
          }
        });
    return true;
  }
  async selectConnectionType(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext):
      Promise<DeviceConnectionType|undefined> {
    const deviceConnectionListPath = context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName,
        DigitalTwinFileNames.devicemodelTemplateFolderName,
        DigitalTwinFileNames.deviceConnectionListFileName));
    const deviceConnectionListJson =
        JSON.parse(fs.readFileSync(deviceConnectionListPath, 'utf8'));
    if (!deviceConnectionListJson) {
      throw new Error('Internal error. Unable to load device connection list.');
    }

    const deviceConnectionList: vscode.QuickPickItem[] = [];
    deviceConnectionListJson.connectionType.forEach(
        (element: PnpDeviceConnectionType) => {
          deviceConnectionList.push(
              {label: element.name, detail: element.detail});
        });

    const deviceConnectionSelection =
        await vscode.window.showQuickPick(deviceConnectionList, {
          ignoreFocusOut: true,
          placeHolder:
              'Please specify how will the device connect to Azure IoT?'
        });

    if (!deviceConnectionSelection) {
      telemetryContext.properties.errorMessage =
          'Connection type selection cancelled.';
      telemetryContext.properties.result = 'Cancelled';
      return;
    }

    const deviceConnection = deviceConnectionListJson.connectionType.find(
        (connectionType: PnpDeviceConnectionType) => {
          return connectionType.name === deviceConnectionSelection.label;
        });

    const connectionType: DeviceConnectionType = DeviceConnectionType
        [deviceConnection.type as keyof typeof DeviceConnectionType];

    return connectionType;
  }

  async getCodeGenProjectName(rootPath: string): Promise<string|undefined> {
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

  async selectProjectType(
      language: string, context: vscode.ExtensionContext,
      telemetryContext: TelemetryContext):
      Promise<CodeGenProjectType|undefined> {
    // Select project type
    const projectTypeListPath = context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName,
        DigitalTwinFileNames.devicemodelTemplateFolderName,
        DigitalTwinFileNames.projectTypeListFileName));
    const projectTypeListJson =
        JSON.parse(fs.readFileSync(projectTypeListPath, 'utf8'));
    if (!projectTypeListJson) {
      throw new Error('Internal error. Unable to load project type list.');
    }

    const result = projectTypeListJson.projectType.filter(
        (projectType: PnpProjectTemplateType) => {
          return (projectType.enabled && projectType.language === language);
        });

    const projectTypeList: vscode.QuickPickItem[] = [];
    result.forEach((element: ProjectTemplate) => {
      projectTypeList.push({label: element.name, detail: element.detail});
    });

    if (!projectTypeList) {
      throw new Error(
          `Internal error. Unable to find project types using ${language}.`);
    }

    const projectTypeSelection = await vscode.window.showQuickPick(
        projectTypeList,
        {ignoreFocusOut: true, placeHolder: 'Please select a target:'});

    if (!projectTypeSelection) {
      telemetryContext.properties.errorMessage =
          'Project type selection cancelled.';
      telemetryContext.properties.result = 'Cancelled';
      return;
    }

    const projectType =
        projectTypeListJson.projectType.find((projectType: ProjectTemplate) => {
          return projectType.name === projectTypeSelection.label;
        });

    const codeGenProjectType: CodeGenProjectType =
        CodeGenProjectType[projectType.type as keyof typeof CodeGenProjectType];

    return codeGenProjectType;
  }

  async selectCapabilityFile(
      channel: vscode.OutputChannel, dcmFiles: dtUtils.SchemaFileInfo[],
      telemetryContext: TelemetryContext):
      Promise<vscode.QuickPickItem|undefined> {
    if (dcmFiles.length === 0) {
      const message =
          'Unable to find Capability Model files in the folder. Please open a folder that contains Capability Model files.';
      vscode.window.showWarningMessage(message);
      return;
    }

    const metamodelItems: vscode.QuickPickItem[] = [];

    dcmFiles.forEach((dcmFile: dtUtils.SchemaFileInfo) => {
      metamodelItems.push({
        label: path.basename(dcmFile.filePath),
        description: path.dirname(dcmFile.filePath)
      });
    });

    const fileSelection = await vscode.window.showQuickPick(metamodelItems, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder:
          `Select a ${DigitalTwinConstants.productName} Capability Model file`
    });

    if (!fileSelection) {
      telemetryContext.properties.errorMessage =
          'Capability Model file selection cancelled.';
      telemetryContext.properties.result = 'Cancelled';
      return;
    }

    return fileSelection;
  }

  async downloadInterfaceFile(
      urnId: string, targetFolder: string, connectionString: string|null,
      channel: vscode.OutputChannel): Promise<boolean> {
    const fileName =
        utils.generateInterfaceFileNameFromUrnId(urnId, targetFolder);

    // Try to download Interface file from company repo
    const dtMetamodelRepositoryClient =
        new DigitalTwinMetamodelRepositoryClient();
    await dtMetamodelRepositoryClient.initialize(connectionString);

    // Try to download Interface file from company repo
    if (connectionString) {
      try {
        const builder = DigitalTwinConnectionStringBuilder.create(
            connectionString.toString());
        const repositoryId = builder.repositoryIdValue;
        const fileMetaData =
            await dtMetamodelRepositoryClient.getInterfaceAsync(
                urnId, repositoryId, true);
        if (fileMetaData) {
          fs.writeFileSync(
              path.join(targetFolder, fileName),
              JSON.stringify(fileMetaData.content, null, 4));
          const message = `${DigitalTwinConstants.dtPrefix} Interface '${
              urnId}' (${
              fileName}) has been successfully downloaded from Company repository.`;
          utils.channelShowAndAppendLine(channel, message);
          return true;
        }
      } catch (error) {
        // Do nothing. Try to download the Interface from public repo
        const message =
            `${DigitalTwinConstants.dtPrefix} Failed to download interface '${
                urnId}' from Company repository. errorcode: ${error.code}`;
        utils.channelShowAndAppendLine(channel, message);
      }
    } else {
      // Try to download Interface file from public repo
      try {
        const fileMetaData =
            await dtMetamodelRepositoryClient.getInterfaceAsync(
                urnId, undefined, true);
        if (fileMetaData) {
          fs.writeFileSync(
              path.join(targetFolder, fileName),
              JSON.stringify(fileMetaData.content, null, 4));
          const message = `${DigitalTwinConstants.dtPrefix} Interface '${
              urnId}' (${
              fileName}) has been successfully downloaded from Public repository.`;
          utils.channelShowAndAppendLine(channel, message);
          return true;
        }
      } catch (error) {
        const message =
            `${DigitalTwinConstants.dtPrefix} Failed to download interface '${
                urnId}' from Public repository. errorcode: ${error.code}`;
        utils.channelShowAndAppendLine(channel, message);
      }
    }
    return false;
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
    // TODO: should check the the integrity of the CodeGen Cli
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
  return path.join(os.homedir(), CodeGenConstants.codeGeneratorToolPath);
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
