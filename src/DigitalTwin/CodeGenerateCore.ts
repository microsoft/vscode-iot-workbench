// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as os from 'os';
import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';
import * as crypto from 'crypto';

import request = require('request-promise');
import {FileNames, ConfigKey, ScaffoldType} from '../constants';
import {TelemetryContext} from '../telemetry';
import {DigitalTwinConstants, CodeGenConstants, DigitalTwinFileNames} from './DigitalTwinConstants';
import {CodeGenProjectType, DeviceConnectionType, PnpLanguage} from './DigitalTwinCodeGen/Interfaces/CodeGenerator';
import {AnsiCCodeGeneratorFactory} from './DigitalTwinCodeGen/AnsiCCodeGeneratorFactory';
import {ConfigHandler} from '../configHandler';
import extractzip = require('extract-zip');
import * as utils from '../utils';
import {DigitalTwinMetamodelRepositoryClient} from './DigitalTwinApi/DigitalTwinMetamodelRepositoryClient';
import {DigitalTwinConnectionStringBuilder} from './DigitalTwinApi/DigitalTwinConnectionStringBuilder';
import {PnpProjectTemplateType, ProjectTemplate, PnpDeviceConnectionType} from '../Models/Interfaces/ProjectTemplate';
import {FileUtility} from '../FileUtility';

const constants = {
  idName: '@id',
  CodeGenConfigFileName: '.codeGenConfigs',
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

interface InterfaceInfo {
  urnId: string;
  path: string;
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

interface CodeGenExecutionItem {
  capabilityModelPath: string;  // relative path of the capability model file
  projectName: string;
  languageLabel: string;
  codeGenProjectType: CodeGenProjectType;
  deviceConnectionType: DeviceConnectionType;
}

interface CodeGenExecutions {
  codeGenExecutionItems: CodeGenExecutionItem[];
}

export class CodeGenerateCore {
  async GenerateDeviceCodeStub(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext): Promise<boolean> {
    // Step 0: update code generator
    const upgradestate: boolean =
        await this.UpgradeCodeGenerator(context, channel);
    channel.show();
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

    // Step 1: Choose capability model
    const interfaceItems: InterfaceInfo[] = [];
    const capabilityModelFileSelection =
        await this.SelectCapabilityFile(rootPath, interfaceItems);
    if (capabilityModelFileSelection === undefined) {
      channel.show();
      channel.appendLine(`Fail to select capability model file.`);
      return false;
    }

    // Step 1.5: Prompt if old project exists for the same capability model file
    const capabilityModelFileName = capabilityModelFileSelection.label;
    const capabilityModelFilePath = path.join(
        capabilityModelFileSelection.description as string,
        capabilityModelFileName);
    const capabilityModelPath =
        path.relative(rootPath, capabilityModelFilePath);

    const codeGenConfigPath = path.join(
        rootPath, FileNames.vscodeSettingsFolderName,
        constants.CodeGenConfigFileName);

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
      channel.show();
      channel.appendLine(`Fail to get code gen project name.`);
      return false;
    }

    const projectPath = path.join(rootPath, codeGenProjectName);
    await FileUtility.mkdirRecursively(ScaffoldType.Local, projectPath);
    channel.appendLine(`${DigitalTwinConstants.dtPrefix} Folder ${
        projectPath} is selected for the generated code.`);

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
      channel.show();
      channel.appendLine(`Fail to select code gen project type.`);
      return false;
    }

    // Step 5: Select device connection string type
    const connectionType = await this.SelectConnectionType(context);
    if (connectionType === undefined) {
      channel.show();
      channel.appendLine(`Fail to select code gen connection type.`);
      return false;
    }

    // Parse the cabability model
    const capabilityModel =
        JSON.parse(fs.readFileSync(capabilityModelFilePath, 'utf8'));

    const implementedInterfaces = capabilityModel['implements'];

    for (const interfaceItem of implementedInterfaces) {
      const schema = interfaceItem.schema;
      if (typeof schema === 'string') {
        // normal interface, check the interface file offline and online
        const item = interfaceItems.find(item => item.urnId === schema);
        if (!item) {
          const result =
              await this.DownloadInterfaceFile(schema, rootPath, channel);
          if (!result) {
            const message = `Unable to get the interface with Id ${
                schema} online. Please make sure the file exists in server.`;
            channel.appendLine(`${DigitalTwinConstants.dtPrefix} ${message}`);
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
              rootPath);
          if (result) {
            vscode.window.showInformationMessage(
                `Generate code stub for ${capabilityModelName} completed`);
          }
        });
    return true;
  }
  async SelectConnectionType(context: vscode.ExtensionContext):
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
      return;
    }

    const deviceConnection = deviceConnectionListJson.connectionType.find(
        (connectionType: PnpDeviceConnectionType) => {
          return connectionType.name === deviceConnectionSelection.label;
        });

    const connectionType: DeviceConnectionType = (DeviceConnectionType)
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
      value: candidateName,
      prompt: 'Please specify the project name.',
      ignoreFocusOut: true,
      validateInput: (applicationName: string) => {
        if (!/^([a-z0-9_]|[a-z0-9_][-a-z0-9_.]*[a-z0-9_])(\.ino)?$/i.test(
                applicationName)) {
          return 'Project name can only contain letters, numbers, "-" and ".", and cannot start or end with "-" or ".".';
        }

        const projectPath = path.join(rootPath, applicationName);
        if (fs.isDirectorySync(projectPath)) {
          return `${projectPath} exists, please choose another name.`;
        }
        return;
      }
    });

    if (!codeGenProjectName) {
      return;
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
      return;
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

    const codeGenProjectType: CodeGenProjectType = (CodeGenProjectType)
        [projectType.type as keyof typeof CodeGenProjectType];

    return codeGenProjectType;
  }

  async SelectCapabilityFile(rootPath: string, interfaceItems: InterfaceInfo[]):
      Promise<vscode.QuickPickItem|undefined> {
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
          } else if (fileName.endsWith(DigitalTwinConstants.interfaceSuffix)) {
            let urnId;
            try {
              const fileJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              urnId = fileJson[constants.idName];
            } catch {
            }
            if (urnId) interfaceItems.push({path: filePath, urnId});
          }
        }
      });
    }

    if (metamodelItems.length === 0) {
      const message =
          'Unable to find capability model files in the folder. Please open a folder that contains capability model files.';
      vscode.window.showWarningMessage(message);
      return;
    }

    const fileSelection = await vscode.window.showQuickPick(metamodelItems, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder:
          `Select a ${DigitalTwinConstants.productName} capability model file`
    });

    if (!fileSelection) {
      return;
    }

    return fileSelection;
  }

  async DownloadInterfaceFile(
      urnId: string, targetFolder: string,
      channel: vscode.OutputChannel): Promise<boolean> {
    const fileName =
        utils.generateInterfaceFileNameFromUrnId(urnId, targetFolder);
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
    }
    if (!connectionString) {
      return false;
    } else {
      // Save connection string info
      await ConfigHandler.update(
          ConfigKey.modelRepositoryKeyName, connectionString,
          vscode.ConfigurationTarget.Global);
      // Try to download interface file from private repo
      const dtMetamodelRepositoryClient =
          new DigitalTwinMetamodelRepositoryClient(connectionString);
      const builder =
          DigitalTwinConnectionStringBuilder.Create(connectionString);
      const repositoryId = builder.RepositoryIdValue;

      // Try to download interface file from private repo
      try {
        const fileMetaData =
            await dtMetamodelRepositoryClient.GetInterfaceAsync(
                urnId, repositoryId, true);
        if (fileMetaData) {
          fs.writeFileSync(
              path.join(targetFolder, fileName),
              JSON.stringify(fileMetaData.content, null, 4));
          channel.appendLine(
              `${DigitalTwinConstants.dtPrefix} Download interface with id ${
                  urnId}, name: ${fileName} into ${targetFolder} completed.`);
          return true;
        }
      } catch (error) {
        // Do nothing. Try to download the interface from global repo
        channel.appendLine(`${
            DigitalTwinConstants.dtPrefix} Unable to get interface with id ${
            urnId} from organizational Model Repository, try global repository instead.`);
      }

      // Try to download interface file from public repo
      try {
        const fileMetaData =
            await dtMetamodelRepositoryClient.GetInterfaceAsync(
                urnId, undefined, true);
        if (fileMetaData) {
          fs.writeFileSync(
              path.join(targetFolder, fileName),
              JSON.stringify(fileMetaData.content, null, 4));
          channel.appendLine(
              `${DigitalTwinConstants.dtPrefix} Download interface with id ${
                  urnId}, name: ${fileName} from global repository into ${
                  targetFolder} completed.`);
          return true;
        }
      } catch (error) {
        channel.appendLine(
            `${DigitalTwinConstants.dtPrefix} Unable to get interface with id ${
                urnId} from global Model Repository. errorcode: ${error.code}`);
      }
    }
    return false;
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
            title: `Upgrading  ${
                DigitalTwinConstants.productName} Code Generator...`
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
    extractzip(sourceZip, {dir: targetFoder}, err => {
      if (err) {
        return reject(err);
      } else {
        return resolve(true);
      }
    });
  });
}
