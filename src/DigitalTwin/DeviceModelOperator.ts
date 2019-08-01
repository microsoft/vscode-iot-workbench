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
import * as dtUtils from './Utilities';
import {DTDLKeywords} from './DigitalTwinConstants';
import {MetaModelType, humanReadableMetaModelType} from './DigitalTwinApi/DataContracts/DigitalTwinContext';
import {DigitalTwinConnector} from './DigitalTwinConnector';
import {DialogResponses} from '../DialogResponses';
import {ConfigKey, FileNames} from '../constants';
import {DigitalTwinConnectionStringBuilder} from './DigitalTwinApi/DigitalTwinConnectionStringBuilder';
import {GetModelResult} from './DigitalTwinApi/DataContracts/DigitalTwinModel';
import {TelemetryContext} from '../telemetry';
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
      placeHolder: `Please input Interface name here.`,
      ignoreFocusOut: true,
      validateInput: (interfaceName: string) => {
        if (!interfaceName || interfaceName.length === 0) {
          return `The Interface name can't be empty`;
        }
        if (!DigitalTwinConstants.dtidSegmentRegex.test(interfaceName)) {
          return `Interface name can only contain ${DigitalTwinConstants.dtidSegmentRegexDescription}.`;
        }
        const interfaceFilename = path.join(
            rootPath as string,
            interfaceName + DigitalTwinConstants.interfaceSuffix);
        if (fs.existsSync(interfaceFilename)) {
          return `The interface file already exists in current folder.`;
        }
        return;
      }
    };

    const interfaceName = await vscode.window.showInputBox(option);

    if (interfaceName === undefined) {
      return false;
    }
    const dtid = dtUtils.GenerateDigitalTwinIdentifier(interfaceName);
    const targetInterface = path.join(
        rootPath, interfaceName + DigitalTwinConstants.interfaceSuffix);

    const interfaceTemplate = context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName,
        DigitalTwinFileNames.devicemodelTemplateFolderName,
        DigitalTwinFileNames.sampleInterfaceName));

    try {
      const content = fs.readFileSync(interfaceTemplate, 'utf8')
                          .replace(DigitalTwinConstants.dtidPlaceholder, dtid);
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
        `New ${DigitalTwinConstants.productName} Interface '${
            dtid}' was created successfully.`);
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
      placeHolder: `Please input Capability Model name here.`,
      ignoreFocusOut: true,
      validateInput: (capabilityModelName: string) => {
        if (!capabilityModelName || capabilityModelName.length === 0) {
          return `The Capability Model name can't be empty`;
        }
        if (!DigitalTwinConstants.dtidSegmentRegex.test(capabilityModelName)) {
          return `Capability Model name can only contain ${DigitalTwinConstants.dtidSegmentRegexDescription}.`;
        }
        const capabilityModelFilename = path.join(
            rootPath as string,
            capabilityModelName + DigitalTwinConstants.capabilityModelSuffix);
        if (fs.existsSync(capabilityModelFilename)) {
          return `The interface file already exists in current folder.`;
        }
        return;
      }
    };

    const capabilityModelName = await vscode.window.showInputBox(option);

    if (capabilityModelName === undefined) {
      return false;
    }

    const dtid = dtUtils.GenerateDigitalTwinIdentifier(capabilityModelName);
    const targetCapabilityModel = path.join(
        rootPath,
        capabilityModelName + DigitalTwinConstants.capabilityModelSuffix);

    const capabilityModel = context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName,
        DigitalTwinFileNames.devicemodelTemplateFolderName,
        DigitalTwinFileNames.sampleCapabilityModelName));

    try {
      const content = fs.readFileSync(capabilityModel, 'utf8')
                          .replace(DigitalTwinConstants.dtidPlaceholder, dtid);
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
        `New ${DigitalTwinConstants.productName} Capability Model '${
            dtid}' was created successfully.`);
    return;
  }

  async ConnectModelRepository(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext): Promise<boolean> {
    const repoItems = [
      {label: 'Public repository', description: ''},
      {label: 'Company repository', description: ''}
    ];

    const repoSelection = await vscode.window.showQuickPick(repoItems, {
      ignoreFocusOut: true,
      placeHolder: 'Please select a repository to connect:'
    });

    if (!repoSelection) {
      return false;
    }

    if (repoSelection.label === 'Public repository') {
      // Open Public repository
      DeviceModelOperator.vscexpress = DeviceModelOperator.vscexpress ||
          new VSCExpress(context, 'DigitalTwinRepositoryViews');
      await DeviceModelOperator.vscexpress.open(
          'index.html?public',
          `${DigitalTwinConstants.productName} Model Repository`,
          vscode.ViewColumn.Two,
          {retainContextWhenHidden: true, enableScripts: true});
      return true;
    }

    // Open Company repository
    const connectionString = await this.RetrieveModelRepoConnectionString();
    if (!connectionString) {
      return false;
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
      return;  // TODO: delete from public repository??
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

    // Retrieve all schema files
    const allInterfaceFiles: dtUtils.SchemaFileInfo[] = [];
    const allDCMFiles: dtUtils.SchemaFileInfo[] = [];
    dtUtils.listAllPnPSchemaFilesSync(rootPath, allDCMFiles, allInterfaceFiles);
    const allFiles = allDCMFiles.concat(allInterfaceFiles);

    // Get the file to submit:
    const fileItems: vscode.QuickPickItem[] = [];

    allFiles.forEach((file: dtUtils.SchemaFileInfo) => {
      fileItems.push(
          {label: path.basename(file.filePath), description: file.id});
    });

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

    const connectionString = await this.RetrieveModelRepoConnectionString();
    if (!connectionString) {
      utils.channelShowAndAppendLine(
          channel, `Company repository not specified, cancel submit.`);
      return false;
    }
    const result =
        await DigitalTwinConnector.ConnectMetamodelRepository(connectionString);
    if (!result) {
      utils.channelShowAndAppendLine(
          channel, `Failed to connect Company repository, cancel submit.`);
      return false;
    }

    const dtMetamodelRepositoryClient =
        new DigitalTwinMetamodelRepositoryClient();
    await dtMetamodelRepositoryClient.initialize(connectionString.toString());
    const builder =
        DigitalTwinConnectionStringBuilder.Create(connectionString.toString());

    const option: SubmitOptions = {overwriteChoice: OverwriteChoice.Unknown};

    for (const selected of selectedFiles) {
      const item = allFiles.find(item => item.id === selected.description);
      if (!item) {
        continue;
      }

      if (item.type === DTDLKeywords.typeValueInterface) {
        // Interface file
        await this.SubmitInterface(
            option, dtMetamodelRepositoryClient, builder, item, channel);
      } else {
        // DCM file
        await this.SubmitCapabilityModel(
            option, dtMetamodelRepositoryClient, builder, item, channel);
      }
    }

    utils.channelShowAndAppendLine(
        channel, `${DigitalTwinConstants.dtPrefix} All submitted.`);
    return true;
  }

  private async RetrieveModelRepoConnectionString(): Promise<string|null> {
    let connectionString =
        await CredentialStore.getCredential(ConfigKey.modelRepositoryKeyName);
    if (!connectionString) {
      const option: vscode.InputBoxOptions = {
        placeHolder: DigitalTwinConstants.repoConnectionStringTemplate,
        prompt: `Please input your company repository connection string.`,
        ignoreFocusOut: true,
        validateInput: (connectionString: string) => {
          if (!connectionString || connectionString.length === 0) {
            return `The connection string can't be empty.`;
          }
          return;
        }
      };

      const connStr = await vscode.window.showInputBox(option);
      if (connStr) {
        connectionString = connStr;
      }
    }
    return connectionString;
  }

  private async SubmitInterface(
      option: SubmitOptions,
      dtMetamodelRepositoryClient: DigitalTwinMetamodelRepositoryClient,
      builder: DigitalTwinConnectionStringBuilder,
      fileInterface: dtUtils.SchemaFileInfo,
      channel: vscode.OutputChannel): Promise<void> {
    let message =
        `${DigitalTwinConstants.dtPrefix} Start uploading interface '${
            fileInterface.id}'(${fileInterface.filePath})...`;
    utils.channelShowAndAppendLine(channel, message);

    const fileContent = fs.readFileSync(fileInterface.filePath, 'utf8');

    let interfaceMetaData: GetModelResult|null = null;

    try {
      // Try to get the file to retrieve the latest etag.
      interfaceMetaData = await dtMetamodelRepositoryClient.GetInterfaceAsync(
          fileInterface.id, builder.RepositoryIdValue, true);
    } catch (error) {
      if (error.statusCode === 404) {
        // New interface
        interfaceMetaData = null;
      } else {
        throw error;
      }
    }

    if (interfaceMetaData) {
      // Update exiting interface
      message =
          `The server already has a interface named '${fileInterface.id}'`;

      if (option.overwriteChoice === OverwriteChoice.Unknown) {
        const result: vscode.MessageItem|undefined =
            await vscode.window.showInformationMessage(
                `${message}, do you want to overwrite it?`, DialogResponses.all,
                DialogResponses.yes, DialogResponses.no);
        if (result === DialogResponses.no) {
          utils.channelShowAndAppendLine(
              channel, `  ${message}, submit cancelled.`);
          return;
        } else if (result === DialogResponses.all) {
          option.overwriteChoice = OverwriteChoice.OverwriteAll;
        }
      }
      utils.channelShowAndAppendLine(channel, `  ${message}, updating...`);
      // Overwrite
      await dtMetamodelRepositoryClient.CreateOrUpdateInterfaceAsync(
          fileContent, fileInterface.id, interfaceMetaData.etag,
          builder.RepositoryIdValue);
    } else {
      // New interface
      await dtMetamodelRepositoryClient.CreateOrUpdateInterfaceAsync(
          fileContent, fileInterface.id, undefined, builder.RepositoryIdValue);
    }

    message = `Interface '${fileInterface.id}'(${
        fileInterface.filePath}) has been successfully submitted.`;
    utils.channelShowAndAppendLine(channel, `  ${message}`);
    vscode.window.showInformationMessage(message);
  }

  private async SubmitCapabilityModel(
      option: SubmitOptions,
      dtMetamodelRepositoryClient: DigitalTwinMetamodelRepositoryClient,
      builder: DigitalTwinConnectionStringBuilder,
      fileDCM: dtUtils.SchemaFileInfo,
      channel: vscode.OutputChannel): Promise<void> {
    let message = `${
        DigitalTwinConstants
            .dtPrefix} Start uploading device capability model '${
        fileDCM.id}'(${fileDCM.filePath})...`;
    utils.channelShowAndAppendLine(channel, message);

    const fileContent = fs.readFileSync(fileDCM.filePath, 'utf8');

    let capabilityModelContext: GetModelResult|null = null;

    try {
      // Try to get the file to retrieve the latest etag.
      capabilityModelContext =
          await dtMetamodelRepositoryClient.GetCapabilityModelAsync(
              fileDCM.id, builder.RepositoryIdValue, true);
    } catch (error) {
      if (error.statusCode === 404) {
        // New DCM
        capabilityModelContext = null;
      } else {
        throw error;
      }
    }

    if (capabilityModelContext) {
      // Update exiting DCM
      message = `The server already has a device capability model named '${
          fileDCM.id}'`;

      if (option.overwriteChoice === OverwriteChoice.Unknown) {
        const result: vscode.MessageItem|undefined =
            await vscode.window.showInformationMessage(
                `${message}, do you want to overwrite it?`, DialogResponses.all,
                DialogResponses.yes, DialogResponses.no);
        if (result === DialogResponses.no) {
          utils.channelShowAndAppendLine(
              channel, `  ${message}, submit cancelled.`);
          return;
        } else if (result === DialogResponses.all) {
          option.overwriteChoice = OverwriteChoice.OverwriteAll;
        }
      }
      utils.channelShowAndAppendLine(channel, `  ${message}, updating...`);
      // Overwrite
      await dtMetamodelRepositoryClient.CreateOrUpdateCapabilityModelAsync(
          fileContent, fileDCM.id, capabilityModelContext.etag,
          builder.RepositoryIdValue);
    } else {
      // New interface
      await dtMetamodelRepositoryClient.CreateOrUpdateCapabilityModelAsync(
          fileContent, fileDCM.id, undefined, builder.RepositoryIdValue);
    }

    message = `Device capability model '${fileDCM.id}'(${
        fileDCM.filePath}) has been successfully submitted.`;
    utils.channelShowAndAppendLine(channel, `  ${message}`);
    vscode.window.showInformationMessage(message);
  }
}
