// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';

import {VSCExpress} from 'vscode-express';
import {DigitalTwinFileNames, DigitalTwinConstants} from './DigitalTwinConstants';
import {DigitalTwinMetamodelRepositoryClient} from './DigitalTwinApi/DigitalTwinMetamodelRepositoryClient';
import * as utils from '../utils';
import {MetaModelType, humanReadableMetaModelType} from './DigitalTwinApi/DataContracts/DigitalTwinContext';
import {DigitalTwinConnector} from './DigitalTwinConnector';
import {DialogResponses} from '../DialogResponses';
import {ConfigHandler} from '../configHandler';
import {ConfigKey, FileNames} from '../constants';
import {DigitalTwinConnectionStringBuilder} from './DigitalTwinApi/DigitalTwinConnectionStringBuilder';
import {GetModelResult} from './DigitalTwinApi/DataContracts/DigitalTwinModel';
import {TelemetryContext} from '../telemetry';
import {Message} from 'azure-iot-common';
import {CookieJar} from 'tough-cookie';
import {CredentialStore} from '../credentialStore';

const constants = {
  storedFilesInfoKeyName: 'StoredFilesInfo',
  idName: '@id'
};

enum OverwriteChoice {
  Unknown = 1,
  OverwriteAll = 2
}

interface SubmitOptions {
  overwriteChoice: OverwriteChoice;
}

export class DeviceModelOperator {
  // Initial the folder for authoring device model, return the root path of the
  // workspace
  private async InitializeFolder(): Promise<string|null> {
    let rootPath: string;

    if (vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length === 1) {
      rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    } else {
      rootPath = await utils.selectWorkspaceItem(
          `Select the folder that will contain your ${
              DigitalTwinConstants.productName} models:`,
          {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.workspace.workspaceFolders &&
                    vscode.workspace.workspaceFolders.length > 0 ?
                vscode.workspace.workspaceFolders[0].uri :
                undefined,
            openLabel: 'Select'
          });
    }

    return rootPath;
  }

  private static vscexpress: VSCExpress|undefined;

  async Load(
      rootPath: string, context: vscode.ExtensionContext,
      channel: vscode.OutputChannel): Promise<boolean> {
    if (!rootPath) {
      return false;
    }

    const files = fs.listSync(rootPath);

    const deviceModelFile = files.find(
        fileName => fileName.endsWith(DigitalTwinConstants.interfaceSuffix) ||
            fileName.endsWith(DigitalTwinConstants.capabilityModelSuffix));

    if (!deviceModelFile) {
      return false;
    }

    return true;
  }

  async CreateInterface(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    let rootPath: string|null = null;
    rootPath = await this.InitializeFolder();
    if (!rootPath) {
      return;
    }

    const option: vscode.InputBoxOptions = {
      value: DigitalTwinFileNames.defaultInterfaceName,
      prompt: `Please input Interface name here.`,
      ignoreFocusOut: true,
      validateInput: (interfaceName: string) => {
        if (!interfaceName) {
          return 'Please provide a valid Interface name.';
        }
        if (!/\.interface\.json$/i.test(interfaceName)) {
          interfaceName += DigitalTwinConstants.interfaceSuffix;
        }

        if (/^([a-z_]|[a-z_][-a-z0-9_.]*[a-z0-9_])(\.interface\.json)?$/i.test(
                interfaceName)) {
          const targetInterface = path.join(rootPath as string, interfaceName);
          if (fs.existsSync(targetInterface)) {
            return `The file with name ${
                interfaceName} already exists in current folder.`;
          }
          return '';
        }
        return 'interface name can only contain alphanumeric and cannot start with number.';
      }
    };

    let interfaceFileName = await vscode.window.showInputBox(option);

    if (interfaceFileName === undefined) {
      return false;
    } else {
      interfaceFileName = interfaceFileName.trim();
      if (!/\.interface\.json$/i.test(interfaceFileName)) {
        interfaceFileName += DigitalTwinConstants.interfaceSuffix;
      }
    }

    const targetInterface = path.join(rootPath, interfaceFileName);

    const interfaceTemplate = context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName,
        DigitalTwinFileNames.devicemodelTemplateFolderName,
        DigitalTwinFileNames.sampleInterfaceName));

    try {
      const content = fs.readFileSync(interfaceTemplate, 'utf8');
      fs.writeFileSync(targetInterface, content);
    } catch (error) {
      throw new Error(
          `Creating ${DigitalTwinConstants.productName} Interface failed: ${
              error.message}`);
    }
    await vscode.commands.executeCommand(
        'vscode.openFolder', vscode.Uri.file(rootPath), false);

    await vscode.window.showTextDocument(vscode.Uri.file(targetInterface));

    vscode.window.showInformationMessage(
        `New ${DigitalTwinConstants.productName} Interface ${
            interfaceFileName} was created successfully.`);
    return;
  }

  async CreateCapabilityModel(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    let rootPath: string|null = null;
    rootPath = await this.InitializeFolder();
    if (!rootPath) {
      return;
    }

    const option: vscode.InputBoxOptions = {
      value: DigitalTwinFileNames.defaultCapabilityModelName,
      prompt: `Please input Capability Model name here:`,
      ignoreFocusOut: true,
      validateInput: (capabilityModelName: string) => {
        if (!capabilityModelName) {
          return 'Please provide a valid Capability Model name.';
        }
        if (!/\.capabilitymodel\.json$/i.test(capabilityModelName)) {
          capabilityModelName += DigitalTwinConstants.capabilityModelSuffix;
        }
        if (/^([a-z_]|[a-z_][-a-z0-9_.]*[a-z0-9_])(\.capabilitymodel\.json)?$/i
                .test(capabilityModelName)) {
          const targetCapabilityModel =
              path.join(rootPath as string, capabilityModelName);
          if (fs.existsSync(targetCapabilityModel)) {
            return `The file with name ${
                capabilityModelName} already exists in current folder.`;
          }
          return '';
        }
        return 'Capability Model name can only contain alphanumeric and cannot start with number.';
      }
    };

    let capabilityModelFileName = await vscode.window.showInputBox(option);

    if (capabilityModelFileName === undefined) {
      return false;
    } else {
      capabilityModelFileName = capabilityModelFileName.trim();
      if (!/\.capabilitymodel\.json$/i.test(capabilityModelFileName)) {
        capabilityModelFileName += DigitalTwinConstants.capabilityModelSuffix;
      }
    }

    const targetCapabilityModel = path.join(rootPath, capabilityModelFileName);

    const capabilityModel = context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName,
        DigitalTwinFileNames.devicemodelTemplateFolderName,
        DigitalTwinFileNames.sampleCapabilityModelName));

    try {
      const content = fs.readFileSync(capabilityModel, 'utf8');
      fs.writeFileSync(targetCapabilityModel, content);
    } catch (error) {
      throw new Error(`Creating ${
          DigitalTwinConstants.productName} Capability Model failed: ${
          error.message}`);
    }

    await vscode.commands.executeCommand(
        'vscode.openFolder', vscode.Uri.file(rootPath), false);

    await vscode.window.showTextDocument(
        vscode.Uri.file(targetCapabilityModel));

    vscode.window.showInformationMessage(
        `New ${DigitalTwinConstants.productName} Capability Model ${
            capabilityModelFileName} created successfully.`);
    return;
  }

  async ConnectModelRepository(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext): Promise<boolean> {
    const repoItems = [
      {label: 'Open Public Model Repository', description: ''},
      {label: 'Open Company Model Repository', description: ''}
    ];

    const repoSelection = await vscode.window.showQuickPick(repoItems, {
      ignoreFocusOut: true,
      placeHolder: 'Please select a repository to connect:'
    });

    if (!repoSelection) {
      return false;
    }

    if (repoSelection.label === 'Open Public Model Repository') {
      // Open Public Model repository
      DeviceModelOperator.vscexpress = DeviceModelOperator.vscexpress ||
          new VSCExpress(context, 'DigitalTwinRepositoryViews');
      await DeviceModelOperator.vscexpress.open(
          'index.html?public',
          `${DigitalTwinConstants.productName} Model Repository`,
          vscode.ViewColumn.Two,
          {retainContextWhenHidden: true, enableScripts: true});
      return true;
    }

    // Open Company Model repository
    let connectionString =
        await CredentialStore.getCredential(ConfigKey.modelRepositoryKeyName);

    if (!connectionString) {
      const option: vscode.InputBoxOptions = {
        value: DigitalTwinConstants.repoConnectionStringTemplate,
        prompt: `Please input the connection string to the ${
            DigitalTwinConstants.productName} Model Repository:`,
        ignoreFocusOut: true
      };

      const connStr = await vscode.window.showInputBox(option);

      if (!connStr) {
        return false;
      } else {
        connectionString = connStr as string;
      }
    }

    const result =
        await DigitalTwinConnector.ConnectMetamodelRepository(connectionString);

    if (result) {
      await CredentialStore.setCredential(
          ConfigKey.modelRepositoryKeyName, connectionString);

      DeviceModelOperator.vscexpress = DeviceModelOperator.vscexpress ||
          new VSCExpress(context, 'DigitalTwinRepositoryViews');
      await DeviceModelOperator.vscexpress.open(
          'index.html', `${DigitalTwinConstants.productName} Model Repository`,
          vscode.ViewColumn.Two,
          {retainContextWhenHidden: true, enableScripts: true});
      return true;
    }
    return false;
  }

  async Disconnect(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    await CredentialStore.deleteCredential(ConfigKey.modelRepositoryKeyName);
    if (DeviceModelOperator.vscexpress) {
      DeviceModelOperator.vscexpress.close('index.html');
    }
    const message = `Sign out ${
        DigitalTwinConstants.productName} Model Repository successfully`;
    vscode.window.showInformationMessage(message);
  }

  async GetInterfaces(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext, usePublicRepository: boolean,
      searchString = '', pageSize = 50, continueToken: string|null = null) {
    if (usePublicRepository) {
      const dtMetamodelRepositoryClient =
          new DigitalTwinMetamodelRepositoryClient();
      await dtMetamodelRepositoryClient.initialize(null);
      const result = await dtMetamodelRepositoryClient.SearchInterfacesAsync(
          searchString, continueToken, undefined, pageSize);
      return result;
    } else {
      const connectionString =
          await CredentialStore.getCredential(ConfigKey.modelRepositoryKeyName);
      if (!connectionString) {
        vscode.window.showWarningMessage(`Failed to get interfaces from ${
            DigitalTwinConstants
                .productName} Model Repository. Please sign out and sign in with a valid connection string.`);
        return;
      }

      const builder = DigitalTwinConnectionStringBuilder.Create(
          connectionString.toString());
      const dtMetamodelRepositoryClient =
          new DigitalTwinMetamodelRepositoryClient();
      await dtMetamodelRepositoryClient.initialize(connectionString.toString());
      const result = await dtMetamodelRepositoryClient.SearchInterfacesAsync(
          searchString, continueToken, builder.RepositoryIdValue, pageSize);
      return result;
    }
  }

  async GetCapabilityModels(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext, usePublicRepository: boolean,
      searchString = '', pageSize = 50, continueToken: string|null = null) {
    if (usePublicRepository) {
      const dtMetamodelRepositoryClient =
          new DigitalTwinMetamodelRepositoryClient();
      await dtMetamodelRepositoryClient.initialize(null);
      const result =
          await dtMetamodelRepositoryClient.SearchCapabilityModelsAsync(
              searchString, continueToken, undefined, pageSize);
      return result;
    } else {
      const connectionString =
          await CredentialStore.getCredential(ConfigKey.modelRepositoryKeyName);
      if (!connectionString) {
        vscode.window.showWarningMessage(`Failed to get Capability Models from ${
            DigitalTwinConstants
                .productName} Model Repository. Please sign out and sign in with a valid connection string.`);
        return;
      }
      const dtMetamodelRepositoryClient =
          new DigitalTwinMetamodelRepositoryClient();
      await dtMetamodelRepositoryClient.initialize(connectionString.toString());
      const builder = DigitalTwinConnectionStringBuilder.Create(
          connectionString.toString());
      const result =
          await dtMetamodelRepositoryClient.SearchCapabilityModelsAsync(
              searchString, continueToken, builder.RepositoryIdValue, pageSize);
      return result;
    }
  }

  async DeleteMetamodelFiles(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext, fileIds: string[],
      metaModelValue: string) {
    if (!fileIds || fileIds.length === 0) {
      const message = `Please select the ${metaModelValue} to delete.`;
      utils.channelShowAndAppendLine(channel, message);
      return;
    }

    const metaModelType: MetaModelType =
        MetaModelType[metaModelValue as keyof typeof MetaModelType];

    const connectionString =
        await CredentialStore.getCredential(ConfigKey.modelRepositoryKeyName);
    if (!connectionString) {
      vscode.window.showWarningMessage(`Failed to delete models from ${
          DigitalTwinConstants
              .productName} Model Repository. Please sign out and sign in with a valid connection string.`);
      return;  // TODO: delete from public model repository??
    }

    const dtMetamodelRepositoryClient =
        new DigitalTwinMetamodelRepositoryClient();
    await dtMetamodelRepositoryClient.initialize(connectionString.toString());
    const builder =
        DigitalTwinConnectionStringBuilder.Create(connectionString.toString());
    for (const id of fileIds) {
      const message = `${DigitalTwinConstants.dtPrefix} Start deleting ${
          metaModelValue} with id ${id}.`;
      utils.channelShowAndAppendLine(channel, message);
      try {
        if (metaModelType === MetaModelType.Interface) {
          await dtMetamodelRepositoryClient.DeleteInterfaceAsync(
              id, builder.RepositoryIdValue);
          const message =
              `${DigitalTwinConstants.dtPrefix} Deleting Interface with id ${
                  id} completed.`;
          utils.channelShowAndAppendLine(channel, message);
        } else {
          await dtMetamodelRepositoryClient.DeleteCapabilityModelAsync(
              id, builder.RepositoryIdValue);
          const message = `${
              DigitalTwinConstants.dtPrefix} Deleting capabilty model with id ${
              id} completed.`;
          utils.channelShowAndAppendLine(channel, message);
        }
      } catch (error) {
        const message = `${DigitalTwinConstants.dtPrefix} Deleting ${
            metaModelValue} with id ${id} failed. Error: ${error.message}`;
        utils.channelShowAndAppendLine(channel, message);
      }
    }
  }

  async DownloadAndEditMetamodelFiles(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext, fileIds: string[],
      metaModelValue: string, usePublicRepository: boolean) {
    if (!fileIds || fileIds.length === 0) {
      const message = `${DigitalTwinConstants.dtPrefix} No ${
          DigitalTwinConstants.productName} model is selected`;
      utils.channelShowAndAppendLine(channel, message);
      return;
    }

    const metaModelType: MetaModelType =
        MetaModelType[metaModelValue as keyof typeof MetaModelType];

    let suffix = DigitalTwinConstants.interfaceSuffix;
    if (metaModelType === MetaModelType.CapabilityModel) {
      suffix = DigitalTwinConstants.capabilityModelSuffix;
    }

    const rootPath = await this.InitializeFolder();
    if (!rootPath) {
      return;
    }

    let repositoryId: string|undefined = undefined;
    let connectionString: string|null = null;

    if (!usePublicRepository) {
      const repoConnectionString =
          await CredentialStore.getCredential(ConfigKey.modelRepositoryKeyName);
      if (!repoConnectionString) {
        return;
      }
      connectionString = repoConnectionString.toString();
      const builder =
          DigitalTwinConnectionStringBuilder.Create(connectionString);
      repositoryId = builder.RepositoryIdValue;
    }

    const dtMetamodelRepositoryClient =
        new DigitalTwinMetamodelRepositoryClient();
    await dtMetamodelRepositoryClient.initialize(connectionString);

    const readableMetaModelValue =
        humanReadableMetaModelType.get(metaModelType) as string;
    for (const id of fileIds) {
      const message = `${DigitalTwinConstants.dtPrefix} Start getting ${
          readableMetaModelValue} with id ${id}.`;
      utils.channelShowAndAppendLine(channel, message);
      let fileMetaData: GetModelResult;
      try {
        if (metaModelType === MetaModelType.Interface) {
          fileMetaData = await dtMetamodelRepositoryClient.GetInterfaceAsync(
              id, repositoryId, true);
        } else {
          fileMetaData =
              await dtMetamodelRepositoryClient.GetCapabilityModelAsync(
                  id, repositoryId, true);
        }
        if (fileMetaData) {
          const modelId = fileMetaData.urnId;
          if (!modelId) {
            throw new Error(`Unable to get the model id of the file.`);
          }

          const names: string[] = modelId.split(':');
          // at least the path should contain urn, namespace, name & version
          if (names.length < 4) {
            throw new Error(`The id of the file is not valid. id: ${modelId}`);
          }

          const displayName = names.join('_');
          let counter = 0;
          let candidateName = displayName + suffix;
          while (true) {
            const filePath = path.join(rootPath, candidateName);
            if (!utils.fileExistsSync(filePath)) {
              break;
            }
            counter++;
            candidateName = `${displayName}_${counter}${suffix}`;
          }

          fs.writeFileSync(
              path.join(rootPath, candidateName),
              JSON.stringify(fileMetaData.content, null, 4));
          await vscode.window.showTextDocument(
              vscode.Uri.file(path.join(rootPath, candidateName)));
          const message = `${DigitalTwinConstants.dtPrefix} Downloading ${
              readableMetaModelValue} with id ${id} into ${
              candidateName} completed.`;
          utils.channelShowAndAppendLine(channel, message);
        }
      } catch (error) {
        const message = `${DigitalTwinConstants.dtPrefix} Downloading ${
            readableMetaModelValue} with id ${id} failed. Error: ${
            error.message}`;
        utils.channelShowAndAppendLine(channel, message);
      }
    }

    await vscode.commands.executeCommand(
        'vscode.openFolder', vscode.Uri.file(rootPath), false);
  }

  async SubmitMetaModelFiles(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext): Promise<boolean> {
    if (!vscode.workspace.workspaceFolders ||
        !vscode.workspace.workspaceFolders[0].uri.fsPath) {
      vscode.window.showWarningMessage(
          'No folder opened in current window. Please select a folder first');
      return false;
    }

    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    if (!rootPath) {
      throw new Error('User cancelled folder selection.');
    }

    // Get the file to submit:
    const fileItems: vscode.QuickPickItem[] = [];

    const fileList = fs.listTreeSync(rootPath);
    if (fileList && fileList.length > 0) {
      fileList.forEach((filePath: string) => {
        if (!fs.isDirectorySync(filePath)) {
          const fileName = path.basename(filePath);
          if (fileName.endsWith(DigitalTwinConstants.interfaceSuffix) ||
              fileName.endsWith(DigitalTwinConstants.capabilityModelSuffix)) {
            fileItems.push(
                {label: fileName, description: path.dirname(filePath)});
          }
        }
      });
    }

    if (fileItems.length === 0) {
      const message = `No ${
          DigitalTwinConstants
              .productName} models found in current folder. Please select the folder that contains ${
          DigitalTwinConstants.productName} models and try again.`;
      vscode.window.showWarningMessage(message);
      return false;
    }

    const selectedFiles = await vscode.window.showQuickPick(fileItems, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: `Select ${DigitalTwinConstants.productName} models`,
      canPickMany: true
    });

    if (!selectedFiles || selectedFiles.length === 0) {
      return false;
    }

    const unsavedFiles =
        vscode.workspace.textDocuments.filter(file => file.isDirty);

    // Is there any unsaved files to be submitted?
    const filterResult = unsavedFiles.filter(
        file => selectedFiles.some(
            ({label, description}) =>
                // TextDocument.fileName is the full path of the file
            file.fileName === path.join(description as string, label)));

    if (filterResult.length > 0) {
      const unsavedFileList =
          filterResult.map(file => path.basename(file.fileName)).toString();
      const messge = `The following file(s) contain unsaved changes: ${
          unsavedFileList}, do you want to save them?`;
      const choice = await vscode.window.showWarningMessage(
          messge, DialogResponses.yes, DialogResponses.cancel);
      if (choice === DialogResponses.yes) {
        for (const document of filterResult) {
          await document.save();
        }
      } else {
        return false;
      }
    }

    const interfaceFiles = selectedFiles.filter(file => {
      return file.label.endsWith(DigitalTwinConstants.interfaceSuffix);
    });

    const capabilityModels = selectedFiles.filter(file => {
      return file.label.endsWith(DigitalTwinConstants.capabilityModelSuffix);
    });

    let connectionString =
        await CredentialStore.getCredential(ConfigKey.modelRepositoryKeyName);
    if (!connectionString) {
      const option: vscode.InputBoxOptions = {
        value: DigitalTwinConstants.repoConnectionStringTemplate,
        prompt: `Please input the connection string to access the ${
            DigitalTwinConstants.productName} Model Repository.`,
        ignoreFocusOut: true
      };

      const connStr = await vscode.window.showInputBox(option);

      if (!connStr) {
        return false;
      } else {
        connectionString = connStr as string;
        const result =
            await DigitalTwinConnector.ConnectMetamodelRepository(connStr);
        if (!result) {
          return false;
        }
      }
    }

    const dtMetamodelRepositoryClient =
        new DigitalTwinMetamodelRepositoryClient();
    await dtMetamodelRepositoryClient.initialize(connectionString.toString());
    const builder =
        DigitalTwinConnectionStringBuilder.Create(connectionString.toString());

    let continueOnFailure = false;
    const option: SubmitOptions = {overwriteChoice: OverwriteChoice.Unknown};

    for (const fileItem of interfaceFiles) {
      const message =
          `${DigitalTwinConstants.dtPrefix} File to submit: ${fileItem.label}`;
      utils.channelShowAndAppendLine(channel, message);
      const filePath =
          path.join(fileItem.description as string, fileItem.label);
      const result = await this.SubmitInterface(
          option, dtMetamodelRepositoryClient, builder, filePath,
          fileItem.label, channel);
      if (!result && !continueOnFailure) {
        const message = `${fileItem.label} was not submitted to ${
            DigitalTwinConstants
                .productName} Model Repository successfully, do you want to continue with rest files?`;
        const continueWithOtherFiles =
            await vscode.window.showInformationMessage(
                message, DialogResponses.yes, DialogResponses.no);
        if (continueWithOtherFiles === DialogResponses.no) {
          return false;
        } else {
          continueOnFailure = true;
        }
      }
    }

    for (const fileItem of capabilityModels) {
      const message =
          `${DigitalTwinConstants.dtPrefix} File to submit: ${fileItem.label}`;
      utils.channelShowAndAppendLine(channel, message);
      const filePath =
          path.join(fileItem.description as string, fileItem.label);
      const result = await this.SubmitCapabilityModel(
          option, dtMetamodelRepositoryClient, builder, filePath,
          fileItem.label, channel);
      if (!result && !continueOnFailure) {
        const message = `${fileItem.label} was not submitted to ${
            DigitalTwinConstants
                .productName} Model Repository successfully, do you want to continue with rest files?`;
        const continueWithOtherFiles =
            await vscode.window.showInformationMessage(
                message, DialogResponses.yes, DialogResponses.no);
        if (continueWithOtherFiles === DialogResponses.no) {
          return false;
        } else {
          continueOnFailure = true;
        }
      }
    }

    return true;
  }

  private async SubmitInterface(
      option: SubmitOptions,
      dtMetamodelRepositoryClient: DigitalTwinMetamodelRepositoryClient,
      builder: DigitalTwinConnectionStringBuilder, filePath: string,
      fileName: string, channel: vscode.OutputChannel): Promise<boolean> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');

      let fileId = '';
      try {
        const fileJson = JSON.parse(fileContent);
        fileId = fileJson[constants.idName];
      } catch (error) {
        const message = `${DigitalTwinConstants.dtPrefix} ${
            fileName} is not a valid ${
            DigitalTwinConstants
                .productName} model. Please modify the content and submit it again.`;
        utils.channelShowAndAppendLine(channel, message);
        vscode.window.showWarningMessage(`${fileName} is not a valid ${
            DigitalTwinConstants
                .productName} model. Please modify the content and submit it again.`);
        return false;
      }

      if (!fileId) {
        vscode.window.showWarningMessage(`Unable to find id from the ${
            DigitalTwinConstants
                .productName} Interface file. Please provide a valid file.`);
        return false;
      }
      let message = `${DigitalTwinConstants.dtPrefix} Load and parse file "${
          fileName}" successfully.`;
      utils.channelShowAndAppendLine(channel, message);
      // check whether file exists in model repo, try to update the file.
      try {
        // First, get the file to retrieve the latest etag.
        message = `${DigitalTwinConstants.dtPrefix} Connect to ${
            DigitalTwinConstants
                .productName} Model Repository to check whether ${
            fileId} exists in server...`;
        utils.channelShowAndAppendLine(channel, message);

        const interfaceMetaData =
            await dtMetamodelRepositoryClient.GetInterfaceAsync(
                fileId, builder.RepositoryIdValue, true);

        message = `${DigitalTwinConstants.dtPrefix} ${
            DigitalTwinConstants.productName} Interface file with id:"${
            fileId}" exists in server. `;
        utils.channelShowAndAppendLine(channel, message);

        if (option.overwriteChoice === OverwriteChoice.Unknown) {
          const msg = `The Interface with id "${
              fileId}" already exists in the ${
              DigitalTwinConstants
                  .productName} Model Repository. Do you want to overwrite it?`;
          const result: vscode.MessageItem|undefined =
              await vscode.window.showInformationMessage(
                  msg, DialogResponses.all, DialogResponses.yes,
                  DialogResponses.no);
          if (result === DialogResponses.no) {
            const message = `${DigitalTwinConstants.dtPrefix} Submitting ${
                DigitalTwinConstants.productName} Interface cancelled.`;
            utils.channelShowAndAppendLine(channel, message);
            return false;
          } else if (result === DialogResponses.all) {
            option.overwriteChoice = OverwriteChoice.OverwriteAll;
          }
        }

        message = `${DigitalTwinConstants.dtPrefix} Start updating ${
            DigitalTwinConstants.productName} Interface with id:"${
            fileId}"... `;
        utils.channelShowAndAppendLine(channel, message);

        const result =
            await dtMetamodelRepositoryClient.CreateOrUpdateInterfaceAsync(
                fileContent, fileId, interfaceMetaData.etag,
                builder.RepositoryIdValue);
        message = `${DigitalTwinConstants.dtPrefix} Submitting ${
            DigitalTwinConstants.productName} Interface file: fileName: "${
            fileName}" successfully, Interface id: "${fileId}". `;
        utils.channelShowAndAppendLine(channel, message);

        vscode.window.showInformationMessage(`${
            DigitalTwinConstants.productName} Interface with Interface id: "${
            fileId}" updated successfully`);
      } catch (error) {
        if (error.statusCode === 404) {
          // Not found
          message = `${DigitalTwinConstants.dtPrefix} ${
              DigitalTwinConstants
                  .productName} Interface file does not exist in server, creating ${
              fileId}... `;
          utils.channelShowAndAppendLine(channel, message);

          // Create the interface.
          const result =
              await dtMetamodelRepositoryClient.CreateOrUpdateInterfaceAsync(
                  fileContent, fileId, undefined, builder.RepositoryIdValue);
          message = `${DigitalTwinConstants.dtPrefix} Submitting ${
              DigitalTwinConstants.productName} interface: fileName: "${
              fileName}" successfully, Interface id: "${fileId}". `;
          utils.channelShowAndAppendLine(channel, message);

          vscode.window.showInformationMessage(`${
              DigitalTwinConstants.productName} Interface with Interface id: "${
              fileId}" created successfully`);
        } else {
          throw error;
        }
      }
    } catch (error) {
      const message = `${DigitalTwinConstants.dtPrefix} Submitting ${
          DigitalTwinConstants.productName} interface: fileName: "${
          fileName}" failed, error: ${error.message}.`;
      utils.channelShowAndAppendLine(channel, message);

      vscode.window.showWarningMessage(`Unable to submit ${
          DigitalTwinConstants.productName} interface, error: ${
          error.message}`);
      return false;
    }

    return true;
  }

  private async SubmitCapabilityModel(
      option: SubmitOptions,
      dtMetamodelRepositoryClient: DigitalTwinMetamodelRepositoryClient,
      builder: DigitalTwinConnectionStringBuilder, filePath: string,
      fileName: string, channel: vscode.OutputChannel): Promise<boolean> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');

      let fileId = '';
      try {
        const fileJson = JSON.parse(fileContent);
        fileId = fileJson[constants.idName];
      } catch (error) {
        const message = `${DigitalTwinConstants.dtPrefix} ${
            fileName} is not a valid ${
            DigitalTwinConstants
                .productName} model. Please modify the content and submit it again.`;
        utils.channelShowAndAppendLine(channel, message);

        vscode.window.showWarningMessage(`${fileName} is not a valid ${
            DigitalTwinConstants
                .productName} model. Please modify the content and submit it again.`);
        return false;
      }

      if (!fileId) {
        vscode.window.showWarningMessage(`Unable to find id from the ${
            DigitalTwinConstants
                .productName} Capability Model file. Please provide a valid file.`);
        return false;
      }
      let message = `${DigitalTwinConstants.dtPrefix} Load and parse file ${
          fileName} successfully.`;
      utils.channelShowAndAppendLine(channel, message);

      // check whether file exists in model repo, try to update the file.
      try {
        // First, get the file to retrieve the latest etag.
        message = `${DigitalTwinConstants.dtPrefix} Connect to ${
            DigitalTwinConstants
                .productName} Model Repository to check whether "${
            fileId}" exists in server...`;
        utils.channelShowAndAppendLine(channel, message);

        const capabilityModelContext =
            await dtMetamodelRepositoryClient.GetCapabilityModelAsync(
                fileId, builder.RepositoryIdValue, true);

        if (option.overwriteChoice === OverwriteChoice.Unknown) {
          const msg = `The Capability Model with id "${
              fileId}" already exists in the ${
              DigitalTwinConstants
                  .productName} Model Repository. Do you want to overwrite it?`;
          const result: vscode.MessageItem|undefined =
              await vscode.window.showInformationMessage(
                  msg, DialogResponses.all, DialogResponses.yes,
                  DialogResponses.no);
          if (result === DialogResponses.no) {
            const message = `${DigitalTwinConstants.dtPrefix} Submitting ${
                DigitalTwinConstants.productName} Capability Model cancelled.`;
            utils.channelShowAndAppendLine(channel, message);

            return false;
          } else if (result === DialogResponses.all) {
            option.overwriteChoice = OverwriteChoice.OverwriteAll;
          }
        }
        message = `${DigitalTwinConstants.dtPrefix} Start updating ${
            DigitalTwinConstants.productName} Capability Model with id:"${
            fileId}"...`;
        utils.channelShowAndAppendLine(channel, message);

        const result = await dtMetamodelRepositoryClient
                           .CreateOrUpdateCapabilityModelAsync(
                               fileContent, fileId, capabilityModelContext.etag,
                               builder.RepositoryIdValue);
        message = `${DigitalTwinConstants.dtPrefix} Submitting ${
            DigitalTwinConstants.productName} Capability Model: fileName: "${
            fileName}" successfully, Capability Model id: "${fileId}". `;
        utils.channelShowAndAppendLine(channel, message);

        vscode.window.showInformationMessage(
            `${DigitalTwinConstants.productName} Capability Model with id: "${
                fileId}" updated successfully`);
      } catch (error) {
        if (error.statusCode === 404) {
          // Not found
          message = `${DigitalTwinConstants.dtPrefix} ${
              DigitalTwinConstants
                  .productName} Capability Model file does not exist in server, creating "${
              fileId}"... `;
          utils.channelShowAndAppendLine(channel, message);

          // Create the interface.
          const result = await dtMetamodelRepositoryClient
                             .CreateOrUpdateCapabilityModelAsync(
                                 fileContent, fileId, undefined,
                                 builder.RepositoryIdValue);
          message = `${DigitalTwinConstants.dtPrefix} Submitting ${
              DigitalTwinConstants.productName} Capability Model: fileName: "${
              fileName}" successfully, Capability Model id: "${fileId}". `;
          utils.channelShowAndAppendLine(channel, message);

          vscode.window.showInformationMessage(
              `${DigitalTwinConstants.productName} Capability Model with id: "${
                  fileId}" created successfully`);
        } else {
          throw error;
        }
      }
    } catch (error) {
      const message = `${DigitalTwinConstants.dtPrefix} Submitting ${
          DigitalTwinConstants.productName} Capability Model: fileName: "${
          fileName}" failed, error: ${error.message}.`;
      utils.channelShowAndAppendLine(channel, message);

      vscode.window.showWarningMessage(`Unable to submit ${
          DigitalTwinConstants.productName} Capability Model, error: ${
          error.message}`);
      return false;
    }

    return true;
  }
}
