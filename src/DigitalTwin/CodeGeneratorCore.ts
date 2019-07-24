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
import {DigitalTwinConstants, CodeGenConstants, DigitalTwinFileNames} from './DigitalTwinConstants';
import {CodeGenProjectType, DeviceConnectionType, PnpLanguage} from './DigitalTwinCodeGen/Interfaces/CodeGenerator';
import {AnsiCCodeGeneratorFactory} from './DigitalTwinCodeGen/AnsiCCodeGeneratorFactory';
import {ConfigHandler} from '../configHandler';
import extractzip = require('extract-zip');
import * as utils from '../utils';
import * as dtUtils from './Utilities';
import {DigitalTwinMetamodelRepositoryClient} from './DigitalTwinApi/DigitalTwinMetamodelRepositoryClient';
import {DigitalTwinConnectionStringBuilder} from './DigitalTwinApi/DigitalTwinConnectionStringBuilder';
import {PnpProjectTemplateType, ProjectTemplate, PnpDeviceConnectionType} from '../Models/Interfaces/ProjectTemplate';
import {DialogResponses} from '../DialogResponses';
import {CredentialStore} from '../credentialStore';

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
  async GenerateDeviceCodeStub(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext): Promise<boolean> {
    // Step 0: update code generator
    const upgradestate: boolean =
        await this.UpgradeCodeGenerator(context, channel);
    if (!upgradestate) {
      const message = `${
          DigitalTwinConstants
              .dtPrefix} Unable to upgrade the Code Generator to the latest version.\r\n Trying to use the existing version.`;
      utils.channelShowAndAppendLine(channel, message);
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
        await this.SelectCapabilityFile(channel, dcmFiles);
    if (capabilityModelFileSelection === undefined) {
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
          return false;
        }

        if (regenSelection.label !== 'Create new project') {
          // Regen code
          const executionResult = await this.GenerateDeviceCodeCore(
              rootPath, codeGenExecutionItem, context, channel,
              telemetryContext);
          return executionResult;
        }
      }
    }

    // Step 2: Get project name
    const codeGenProjectName = await this.GetCodeGenProjectName(rootPath);
    if (codeGenProjectName === undefined) {
      const message =
          `The input project name is not valid. Generating code would stop.`;
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
      return false;
    }

    // Step 4: Select project type
    const codeGenProjectType =
        await this.SelectProjectType(languageSelection.label, context);
    if (codeGenProjectType === undefined) {
      return false;
    }

    // Step 5: Select device connection string type
    const connectionType = await this.SelectConnectionType(context, channel);
    if (connectionType === undefined) {
      return false;
    }

    // Parse the cabability model
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

            if (!connectionString) {
              const option: vscode.InputBoxOptions = {
                value: DigitalTwinConstants.repoConnectionStringTemplate,
                prompt:
                    `Please input the connection string to access the company repository. Press Esc to use public repository only`,
                ignoreFocusOut: true
              };

              const connStr = await vscode.window.showInputBox(option);
              if (connStr) {
                connectionString = connStr as string;
                // Save connection string info
                await CredentialStore.setCredential(
                    ConfigKey.modelRepositoryKeyName, connectionString);
              }
              credentialChecked = true;
            }
          }

          const result = await this.DownloadInterfaceFile(
              schema, rootPath, connectionString, channel);
          if (!result) {
            const message = `Unable to get the Interface with Id ${
                schema} online. Please make sure the file exists in server.`;
            utils.channelShowAndAppendLine(
                channel, `${DigitalTwinConstants.dtPrefix} ${message}`);
            vscode.window.showWarningMessage(message);
            return false;
          }
        }
      }
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

    const executionResult = await this.GenerateDeviceCodeCore(
        rootPath, codeGenExecutionInfo, context, channel, telemetryContext);

    return executionResult;
  }

  async GenerateDeviceCodeCore(
      rootPath: string, codeGenExecutionInfo: CodeGenExecutionItem,
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
          const result = await codeGenerator.GenerateCode(
              projectPath, capabilityModelFilePath, capabilityModelName,
              capabilityModelId, rootPath);
          if (result) {
            vscode.window.showInformationMessage(
                `Generate code stub for ${capabilityModelName} completed`);
          }
        });
    return true;
  }
  async SelectConnectionType(
      context: vscode.ExtensionContext,
      channel: vscode.OutputChannel): Promise<DeviceConnectionType|undefined> {
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

  async GetCodeGenProjectName(rootPath: string): Promise<string|undefined> {
    let counter = 0;
    const appName = constants.defaultAppName;
    let candidateName = appName;
    while (true) {
      const appPath = path.join(rootPath, candidateName);
      const appPathExists = fs.isDirectorySync(appPath);
      if (!appPathExists) {
        break;
      }

      counter++;
      candidateName = `${appName}_${counter}`;
    }

    // select the application name for code gen
    const codeGenProjectName = await vscode.window.showInputBox({
      placeHolder: 'Project name?',
      prompt: `Please specify the project name:`,
      ignoreFocusOut: true,
      validateInput: (applicationName: string) => {
        if (!/^([a-z0-9_]|[a-z0-9_][-a-z0-9_.]*[a-z0-9_])(\.ino)?$/i.test(
                applicationName)) {
          return 'Project name can only contain letters, numbers, "-" and ".", and cannot start or end with "-" or ".".';
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

  async SelectProjectType(language: string, context: vscode.ExtensionContext):
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
          return projectType.language === language;
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

  async SelectCapabilityFile(
      channel: vscode.OutputChannel, dcmFiles: dtUtils.SchemaFileInfo[]):
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
      return;
    }

    return fileSelection;
  }

  async DownloadInterfaceFile(
      urnId: string, targetFolder: string, connectionString: string|null,
      channel: vscode.OutputChannel): Promise<boolean> {
    const fileName =
        utils.generateInterfaceFileNameFromUrnId(urnId, targetFolder);

    // Try to download Interface file from private repo
    const dtMetamodelRepositoryClient =
        new DigitalTwinMetamodelRepositoryClient();
    await dtMetamodelRepositoryClient.initialize(connectionString);

    // Try to download Interface file from private repo
    if (connectionString) {
      try {
        const builder = DigitalTwinConnectionStringBuilder.Create(
            connectionString.toString());
        const repositoryId = builder.RepositoryIdValue;
        const fileMetaData =
            await dtMetamodelRepositoryClient.GetInterfaceAsync(
                urnId, repositoryId, true);
        if (fileMetaData) {
          fs.writeFileSync(
              path.join(targetFolder, fileName),
              JSON.stringify(fileMetaData.content, null, 4));
          const message =
              `${DigitalTwinConstants.dtPrefix} Download Interface with id ${
                  urnId}, name: ${fileName} into ${targetFolder} completed.`;
          utils.channelShowAndAppendLine(channel, message);
          return true;
        }
      } catch (error) {
        // Do nothing. Try to download the Interface from public repo
        const message =
            `${DigitalTwinConstants.dtPrefix} Unable to get Interface with id ${
                urnId} from Company repository, try public repository instead.`;
        utils.channelShowAndAppendLine(channel, message);
      }
    }
    // Try to download Interface file from public repo
    try {
      const fileMetaData = await dtMetamodelRepositoryClient.GetInterfaceAsync(
          urnId, undefined, true);
      if (fileMetaData) {
        fs.writeFileSync(
            path.join(targetFolder, fileName),
            JSON.stringify(fileMetaData.content, null, 4));
        const message =
            `${DigitalTwinConstants.dtPrefix} Download Interface with id ${
                urnId}, name: ${fileName} from public repository into ${
                targetFolder} completed.`;
        utils.channelShowAndAppendLine(channel, message);
        return true;
      }
    } catch (error) {
      const message =
          `${DigitalTwinConstants.dtPrefix} Unable to get Interface with id ${
              urnId} from public repository. errorcode: ${error.code}`;
      utils.channelShowAndAppendLine(channel, message);
    }
    return false;
  }

  async UpgradeCodeGenerator(
      context: vscode.ExtensionContext,
      channel: vscode.OutputChannel): Promise<boolean> {
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
      const message = `${
          DigitalTwinConstants
              .dtPrefix} Unable to get the updated version the ${
          DigitalTwinConstants.productName} Code Generator.`;
      utils.channelShowAndAppendLine(channel, message);
      return false;
    }

    // detect version for upgrade
    let needUpgrade = false;
    const platform = os.platform();
    const homeDir = os.homedir();

    const codeGenCommandPath =
        path.join(homeDir, CodeGenConstants.codeGeneratorToolPath);

    // Can we find the target dir for Code Generator?
    let upgradeMessage = '';
    const firstInstallMessage = `${
        DigitalTwinConstants
            .dtPrefix} No Code Generator package found. Start installing ${
        DigitalTwinConstants.productName} Code Generator...`;
    let processTitle =
        `Installing ${DigitalTwinConstants.productName} Code Generator...`;
    if (!fs.isDirectorySync(codeGenCommandPath)) {
      needUpgrade = true;
      upgradeMessage = firstInstallMessage;
    } else {
      const files = fs.listSync(codeGenCommandPath);
      if (!files || files.length === 0) {
        needUpgrade = true;
        upgradeMessage = firstInstallMessage;
      } else {
        // Then check the version
        const currentVersion =
            ConfigHandler.get<string>(ConfigKey.codeGeneratorVersion);
        if (!currentVersion) {
          needUpgrade = true;
          upgradeMessage = firstInstallMessage;
        } else if (
            compareVersion(
                targetConfigItem.codeGeneratorVersion, currentVersion) > 0) {
          needUpgrade = true;
          upgradeMessage =
              `${DigitalTwinConstants.dtPrefix} The latest version of ${
                  DigitalTwinConstants.productName} Code Generator is ${
                  targetConfigItem.codeGeneratorVersion} and you have ${
                  currentVersion}. Start upgrading ${
                  DigitalTwinConstants.productName} Code Generator to ${
                  targetConfigItem.codeGeneratorVersion}...`;
          processTitle =
              `Upgrading ${DigitalTwinConstants.productName} Code Generator...`;
        }
      }
    }

    if (needUpgrade) {
      await vscode.window.withProgress(
          {location: vscode.ProgressLocation.Notification, title: processTitle},
          async () => {
            const message = upgradeMessage;
            utils.channelShowAndAppendLine(channel, message);

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
              const message = `Step 1: Downloading package for ${
                  DigitalTwinConstants.productName} Code Generator...`;
              utils.channelShowAndAppendLine(channel, message);
              const zipData = await request(downloadOption).promise();
              const tempPath =
                  path.join(os.tmpdir(), FileNames.iotworkbenchTempFolder);
              const filePath = path.join(tempPath, `${md5value}.zip`);
              fs.writeFileSync(filePath, zipData);
              clearInterval(loading);
              utils.channelShowAndAppendLine(channel, 'Download complete');

              // Validate hash code
              utils.channelShowAndAppendLine(
                  channel, 'Step 2: Validating hash code for the package...');

              const hashvalue = await fileHash(filePath);
              if (hashvalue !== md5value) {
                throw new Error('Validating hash code failed.');
              } else {
                utils.channelShowAndAppendLine(
                    channel, 'Validating hash code successfully.');
              }

              utils.channelShowAndAppendLine(
                  channel,
                  `Step 3: Extracting Azure IoT ${
                      DigitalTwinConstants.productName} Code Generator.`);

              await extract(filePath, codeGenCommandPath);
              utils.channelShowAndAppendLine(
                  channel,
                  `${
                      DigitalTwinConstants
                          .productName} Code Generator updated successfully.`);
              await ConfigHandler.update(
                  ConfigKey.codeGeneratorVersion,
                  configItem.codeGeneratorVersion,
                  vscode.ConfigurationTarget.Global);
            } catch (error) {
              clearInterval(loading);
              utils.channelShowAndAppendLine(channel, '');
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
    extractzip(sourceZip, {dir: targetFoder}, err => {
      if (err) {
        return reject(err);
      } else {
        return resolve(true);
      }
    });
  });
}
