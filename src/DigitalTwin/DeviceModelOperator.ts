// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';
import * as url from 'url';

import {VSCExpress} from 'vscode-express';
import {DigitalTwinFileNames, DigitalTwinConstants} from './DigitalTwinConstants';
import {DigitalTwinMetamodelRepositoryClient} from './DigitalTwinApi/DigitalTwinMetamodelRepositoryClient';
import * as utils from '../utils';
import {MetaModelType} from './DigitalTwinApi/DataContracts/DigitalTwinContext';
import {DigitalTwinConnector} from './DigitalTwinConnector';
import {DialogResponses} from '../DialogResponses';
import {ConfigHandler} from '../configHandler';
import {ConfigKey} from '../constants';
import {DigitalTwinConnectionStringBuilder} from './DigitalTwinApi/DigitalTwinConnectionStringBuilder';
import {DigitalTwinModel, DigitalTwinModelBase} from './DigitalTwinApi/DataContracts/DigitalTwinModel';

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
      context: vscode.ExtensionContext, channel: vscode.OutputChannel) {
    let rootPath: string|null = null;
    rootPath = await this.InitializeFolder();
    if (!rootPath) {
      return;
    }

    const option: vscode.InputBoxOptions = {
      value: DigitalTwinFileNames.defaultInterfaceName,
      prompt: `Please input interface name here.`,
      ignoreFocusOut: true,
      validateInput: (interfaceName: string) => {
        if (!interfaceName) {
          return 'Please provide a valid interface name.';
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
        DigitalTwinFileNames.resourcesFolderName,
        DigitalTwinFileNames.deviceModelFolderName,
        DigitalTwinFileNames.sampleInterfaceName));

    try {
      const interfaceNamePattern = /{INTERFACENAME}/g;
      const content = fs.readFileSync(interfaceTemplate, 'utf8');
      const matchItems = interfaceFileName.match(/^(.*?)\.(interface)\.json$/);
      if (!matchItems || !matchItems[1]) {
        return false;
      }
      const replaceStr = content.replace(interfaceNamePattern, matchItems[1]);
      fs.writeFileSync(targetInterface, replaceStr);
    } catch (error) {
      throw new Error(
          `Creating ${DigitalTwinConstants.productName} interface failed: ${
              error.message}`);
    }
    await vscode.commands.executeCommand(
        'vscode.openFolder', vscode.Uri.file(rootPath), false);

    await vscode.window.showTextDocument(vscode.Uri.file(targetInterface));

    vscode.window.showInformationMessage(
        `New ${DigitalTwinConstants.productName} interface ${
            interfaceFileName} was created successfully.`);
    return;
  }

  async CreateCapabilityModel(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel) {
    let rootPath: string|null = null;
    rootPath = await this.InitializeFolder();
    if (!rootPath) {
      return;
    }

    const option: vscode.InputBoxOptions = {
      value: DigitalTwinFileNames.defaultCapabilityModelName,
      prompt: `Please input capability model name here:`,
      ignoreFocusOut: true,
      validateInput: (capabilityModelName: string) => {
        if (!capabilityModelName) {
          return 'Please provide a valid capability model name.';
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
        return 'Capability model name can only contain alphanumeric and cannot start with number.';
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
        DigitalTwinFileNames.resourcesFolderName,
        DigitalTwinFileNames.deviceModelFolderName,
        DigitalTwinFileNames.sampleCapabilityModelName));

    try {
      const content = fs.readFileSync(capabilityModel, 'utf8');
      const capabilityModelNamePattern = /{CAPABILITYMODELNAME}/g;
      const matchItems =
          capabilityModelFileName.match(/^(.*?)\.(capabilitymodel)\.json$/);
      if (!matchItems || !matchItems[1]) {
        return false;
      }
      const replaceStr =
          content.replace(capabilityModelNamePattern, matchItems[1]);
      fs.writeFileSync(targetCapabilityModel, replaceStr);
    } catch (error) {
      throw new Error(`Creating ${
          DigitalTwinConstants.productName} capability model failed: ${
          error.message}`);
    }

    await vscode.commands.executeCommand(
        'vscode.openFolder', vscode.Uri.file(rootPath), false);

    await vscode.window.showTextDocument(
        vscode.Uri.file(targetCapabilityModel));

    vscode.window.showInformationMessage(
        `New ${DigitalTwinConstants.productName} capability model ${
            capabilityModelFileName} created successfully.`);
    return;
  }

  async ConnectModelRepository(
      context: vscode.ExtensionContext,
      channel: vscode.OutputChannel): Promise<boolean> {
    const repoItems = [
      {label: 'Open Public Model Repository', description: ''},
      {label: 'Open Organizational Model Repository', description: ''}
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
          'index.html?public', `${DigitalTwinConstants.productName} Repository`,
          vscode.ViewColumn.Two,
          {retainContextWhenHidden: true, enableScripts: true});
      return true;
    }

    // Open Organizational Model repository
    let connectionString =
        ConfigHandler.get<string>(ConfigKey.modelRepositoryKeyName);

    if (!connectionString) {
      const option: vscode.InputBoxOptions = {
        value: DigitalTwinConstants.repoConnectionStringTemplate,
        prompt: `Please input the connection string to the ${
            DigitalTwinConstants.productName} repository:`,
        ignoreFocusOut: true
      };

      connectionString = await vscode.window.showInputBox(option);

      if (!connectionString) {
        return false;
      }
    }

    const result =
        await DigitalTwinConnector.ConnectMetamodelRepository(connectionString);

    if (result) {
      await ConfigHandler.update(
          ConfigKey.modelRepositoryKeyName, connectionString,
          vscode.ConfigurationTarget.Global);

      DeviceModelOperator.vscexpress = DeviceModelOperator.vscexpress ||
          new VSCExpress(context, 'DigitalTwinRepositoryViews');
      await DeviceModelOperator.vscexpress.open(
          'index.html', `${DigitalTwinConstants.productName} Repository`,
          vscode.ViewColumn.Two,
          {retainContextWhenHidden: true, enableScripts: true});
      return true;
    }
    return false;
  }

  async Disconnect() {
    await ConfigHandler.update(
        ConfigKey.modelRepositoryKeyName, '',
        vscode.ConfigurationTarget.Global);
    if (DeviceModelOperator.vscexpress) {
      DeviceModelOperator.vscexpress.close('index.html');
    }
    const message =
        `Sign out ${DigitalTwinConstants.productName} repository successfully`;
    vscode.window.showInformationMessage(message);
  }


  async GetInterfaces(
      context: vscode.ExtensionContext, usePublicRepository: boolean,
      searchString = '', pageSize = 50, continueToken: string|null = null) {
    if (usePublicRepository) {
      const dtMetamodelRepositoryClient =
          new DigitalTwinMetamodelRepositoryClient(null);

      const result = await dtMetamodelRepositoryClient.SearchInterfacesAsync(
          searchString, continueToken, undefined, pageSize);
      return result;
    } else {
      const connectionString =
          ConfigHandler.get<string>(ConfigKey.modelRepositoryKeyName);
      if (!connectionString) {
        vscode.window.showWarningMessage(`Failed to get interfaces from ${
            DigitalTwinConstants
                .productName} repository. Please sign out and sign in with a valid connection string.`);
        return;
      }

      const builder =
          DigitalTwinConnectionStringBuilder.Create(connectionString);
      const dtMetamodelRepositoryClient =
          new DigitalTwinMetamodelRepositoryClient(connectionString);
      const result = await dtMetamodelRepositoryClient.SearchInterfacesAsync(
          searchString, continueToken, builder.RepositoryIdValue, pageSize);
      return result;
    }
  }

  async GetCapabilityModels(
      context: vscode.ExtensionContext, usePublicRepository: boolean,
      searchString = '', pageSize = 50, continueToken: string|null = null) {
    if (usePublicRepository) {
      const dtMetamodelRepositoryClient =
          new DigitalTwinMetamodelRepositoryClient(null);

      const result =
          await dtMetamodelRepositoryClient.SearchCapabilityModelsAsync(
              searchString, continueToken, undefined, pageSize);
      return result;
    } else {
      const connectionString =
          ConfigHandler.get<string>(ConfigKey.modelRepositoryKeyName);
      if (!connectionString) {
        vscode.window.showWarningMessage(`Failed to get capability models from ${
            DigitalTwinConstants
                .productName} repository. Please sign out and sign in with a valid connection string.`);
        return;
      }
      const dtMetamodelRepositoryClient =
          new DigitalTwinMetamodelRepositoryClient(connectionString);
      const builder =
          DigitalTwinConnectionStringBuilder.Create(connectionString);
      const result =
          await dtMetamodelRepositoryClient.SearchCapabilityModelsAsync(
              searchString, continueToken, builder.RepositoryIdValue, pageSize);
      return result;
    }
  }

  async DeleteMetamodelFiles(
      fileIds: string[], metaModelValue: string,
      context: vscode.ExtensionContext, channel: vscode.OutputChannel) {
    channel.show();
    if (!fileIds || fileIds.length === 0) {
      channel.appendLine(`Please select the ${metaModelValue} to delete.`);
      return;
    }

    const metaModelType: MetaModelType =
        MetaModelType[metaModelValue as keyof typeof MetaModelType];

    const connectionString =
        ConfigHandler.get<string>(ConfigKey.modelRepositoryKeyName);
    if (!connectionString) {
      vscode.window.showWarningMessage(`Failed to delete models from ${
          DigitalTwinConstants
              .productName} repository. Please sign out and sign in with a valid connection string.`);
      return;  // TODO: delete from public model repository??
    }

    const dtMetamodelRepositoryClient =
        new DigitalTwinMetamodelRepositoryClient(connectionString);
    const builder = DigitalTwinConnectionStringBuilder.Create(connectionString);
    for (const id of fileIds) {
      channel.appendLine(`${DigitalTwinConstants.dtPrefix} Start deleting ${
          metaModelValue} with id ${id}.`);
      try {
        if (metaModelType === MetaModelType.Interface) {
          await dtMetamodelRepositoryClient.DeleteInterfaceAsync(
              id, builder.RepositoryIdValue);
          channel.appendLine(
              `${DigitalTwinConstants.dtPrefix} Deleting interface with id ${
                  id} completed.`);
        } else {
          await dtMetamodelRepositoryClient.DeleteCapabilityModelAsync(
              id, builder.RepositoryIdValue);
          channel.appendLine(`${
              DigitalTwinConstants.dtPrefix} Deleting capabilty model with id ${
              id} completed.`);
        }
      } catch (error) {
        channel.appendLine(`${DigitalTwinConstants.dtPrefix} Deleting ${
            metaModelValue} with id ${id} failed. Error: ${error.message}`);
      }
    }
  }

  async DownloadAndEditMetamodelFiles(
      fileIds: string[], metaModelValue: string, usePublicRepository: boolean,
      context: vscode.ExtensionContext, channel: vscode.OutputChannel) {
    channel.show();
    if (!fileIds || fileIds.length === 0) {
      channel.appendLine(`${DigitalTwinConstants.dtPrefix} No ${
          DigitalTwinConstants.productName} model is selected.`);
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
          ConfigHandler.get<string>(ConfigKey.modelRepositoryKeyName);
      if (!repoConnectionString) {
        return;
      }
      connectionString = repoConnectionString;
      const builder =
          DigitalTwinConnectionStringBuilder.Create(connectionString);
      repositoryId = builder.RepositoryIdValue;
    }

    const dtMetamodelRepositoryClient =
        new DigitalTwinMetamodelRepositoryClient(connectionString);

    for (const id of fileIds) {
      channel.appendLine(`${DigitalTwinConstants.dtPrefix} Start getting ${
          metaModelValue} with id ${id}.`);
      let fileMetaData: DigitalTwinModel;
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
          const fileJson = JSON.parse(fileMetaData.contents as string);
          const pathName = url.parse(fileJson[constants.idName]).pathname;
          if (!pathName) {
            throw new Error(`Unable to parse the id of the file. id: ${
                fileJson[constants.idName]}`);
          }

          const names: string[] = pathName.replace(/^\//, '').split('/');
          // at least the path should contain name & version
          if (names.length < 2) {
            throw new Error(`The id of the file is not valid. id: ${
                fileJson[constants.idName]}`);
          }

          const displayName = names[names.length - 2];
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
              fileMetaData.contents as string);
          await vscode.window.showTextDocument(
              vscode.Uri.file(path.join(rootPath, candidateName)));
          channel.appendLine(`${DigitalTwinConstants.dtPrefix} Downloading ${
              metaModelValue} with id ${id} into ${candidateName} completed.`);
        }

      } catch (error) {
        channel.appendLine(`${DigitalTwinConstants.dtPrefix} Downloading ${
            metaModelValue} with id ${id} failed. Error: ${error.message}`);
      }
    }

    await vscode.commands.executeCommand(
        'vscode.openFolder', vscode.Uri.file(rootPath), false);
  }

  async SubmitMetaModelFiles(
      context: vscode.ExtensionContext,
      channel: vscode.OutputChannel): Promise<boolean> {
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

    channel.show();

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
        ConfigHandler.get<string>(ConfigKey.modelRepositoryKeyName);
    if (!connectionString) {
      const option: vscode.InputBoxOptions = {
        value: DigitalTwinConstants.repoConnectionStringTemplate,
        prompt: `Please input the connection string to access the ${
            DigitalTwinConstants.productName} repository.`,
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

    const dtMetamodelRepositoryClient =
        new DigitalTwinMetamodelRepositoryClient(connectionString);
    const builder = DigitalTwinConnectionStringBuilder.Create(connectionString);

    let continueOnFailure = false;
    const option: SubmitOptions = {overwriteChoice: OverwriteChoice.Unknown};

    for (const fileItem of interfaceFiles) {
      channel.appendLine(
          `${DigitalTwinConstants.dtPrefix} File to submit: ${fileItem.label}`);
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
      channel.appendLine(
          `${DigitalTwinConstants.dtPrefix} File to submit: ${fileItem.label}`);
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
        channel.appendLine(`${DigitalTwinConstants.dtPrefix} ${
            fileName} is not a valid ${
            DigitalTwinConstants
                .productName} model. Please modify the content and submit it again.`);
        vscode.window.showWarningMessage(`${fileName} is not a valid ${
            DigitalTwinConstants
                .productName} model. Please modify the content and submit it again.`);
        return false;
      }

      if (!fileId) {
        vscode.window.showWarningMessage(`Unable to find id from the ${
            DigitalTwinConstants
                .productName} interface file. Please provide a valid file.`);
        return false;
      }
      channel.appendLine(
          `${DigitalTwinConstants.dtPrefix} Load and parse file: "${
              fileName}" successfully.`);
      // check whether file exists in model repo, try to update the file.
      try {
        // First, get the file to retrieve the latest etag.
        channel.appendLine(`${DigitalTwinConstants.dtPrefix} Connect to ${
            DigitalTwinConstants.productName} repository to check whether ${
            fileId} exists in server...`);
        const interfaceMetaData =
            await dtMetamodelRepositoryClient.GetInterfaceAsync(
                fileId, builder.RepositoryIdValue, true);

        channel.appendLine(`${DigitalTwinConstants.dtPrefix} ${
            DigitalTwinConstants.productName} interface file with id:"${
            fileId}" exists in server. `);

        if (option.overwriteChoice === OverwriteChoice.Unknown) {
          const msg =
              `The interface with id "${fileId}" already exists in the ${
                  DigitalTwinConstants
                      .productName} Repository, do you want to overwrite it?`;
          const result: vscode.MessageItem|undefined =
              await vscode.window.showInformationMessage(
                  msg, DialogResponses.all, DialogResponses.yes,
                  DialogResponses.no);
          if (result === DialogResponses.no) {
            channel.appendLine(`${DigitalTwinConstants.dtPrefix} Submitting ${
                DigitalTwinConstants.productName} interface cancelled.`);
            return false;
          } else if (result === DialogResponses.all) {
            option.overwriteChoice = OverwriteChoice.OverwriteAll;
          }
        }

        channel.appendLine(`${DigitalTwinConstants.dtPrefix} Start updating ${
            DigitalTwinConstants.productName} interface with id:"${
            fileId}"... `);

        const result =
            await dtMetamodelRepositoryClient.CreateOrUpdateInterfaceAsync(
                fileContent, fileId, interfaceMetaData.etag,
                builder.RepositoryIdValue);
        channel.appendLine(`${DigitalTwinConstants.dtPrefix} Submitting ${
            DigitalTwinConstants.productName} interface file: fileName: "${
            fileName}" successfully, interface id: "${fileId}". `);
        vscode.window.showInformationMessage(`${
            DigitalTwinConstants.productName} interface with interface id: "${
            fileId}" updated successfully`);
      } catch (error) {
        if (error.statusCode === 404)  // Not found
        {
          channel.appendLine(`${DigitalTwinConstants.dtPrefix} ${
              DigitalTwinConstants
                  .productName} interface file does not exist in server, creating ${
              fileId}... `);
          // Create the interface.
          const result =
              await dtMetamodelRepositoryClient.CreateOrUpdateInterfaceAsync(
                  fileContent, fileId, undefined, builder.RepositoryIdValue);
          channel.appendLine(`${DigitalTwinConstants.dtPrefix} Submitting ${
              DigitalTwinConstants.productName} interface: fileName: "${
              fileName}" successfully, interface id: "${fileId}". `);
          vscode.window.showInformationMessage(`${
              DigitalTwinConstants.productName} interface with interface id: "${
              fileId}" created successfully`);
        } else {
          throw error;
        }
      }
    } catch (error) {
      channel.appendLine(`${DigitalTwinConstants.dtPrefix} Submitting ${
          DigitalTwinConstants.productName} interface: fileName: "${
          fileName}" failed, error: ${error.message}.`);
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
        channel.appendLine(`${DigitalTwinConstants.dtPrefix} ${
            fileName} is not a valid ${
            DigitalTwinConstants
                .productName} model. Please modify the content and submit it again.`);
        vscode.window.showWarningMessage(`${fileName} is not a valid ${
            DigitalTwinConstants
                .productName} model. Please modify the content and submit it again.`);
        return false;
      }

      if (!fileId) {
        vscode.window.showWarningMessage(`Unable to find id from the ${
            DigitalTwinConstants
                .productName} capability model file. Please provide a valid file.`);
        return false;
      }
      channel.appendLine(
          `${DigitalTwinConstants.dtPrefix} Load and parse file: ${
              fileName} successfully.`);
      // check whether file exists in model repo, try to update the file.
      try {
        // First, get the file to retrieve the latest etag.
        channel.appendLine(`${DigitalTwinConstants.dtPrefix} Connect to ${
            DigitalTwinConstants.productName} repository to check whether "${
            fileId}" exists in server...`);
        const capabilityModelContext =
            await dtMetamodelRepositoryClient.GetCapabilityModelAsync(
                fileId, builder.RepositoryIdValue, true);

        if (option.overwriteChoice === OverwriteChoice.Unknown) {
          const msg =
              `The capability model with id "${fileId}" already exists in the ${
                  DigitalTwinConstants
                      .productName} Repository, do you want to overwrite it?`;
          const result: vscode.MessageItem|undefined =
              await vscode.window.showInformationMessage(
                  msg, DialogResponses.all, DialogResponses.yes,
                  DialogResponses.no);
          if (result === DialogResponses.no) {
            channel.appendLine(`${DigitalTwinConstants.dtPrefix} Submitting ${
                DigitalTwinConstants.productName} capability model cancelled.`);
            return false;
          } else if (result === DialogResponses.all) {
            option.overwriteChoice = OverwriteChoice.OverwriteAll;
          }
        }

        channel.appendLine(`${DigitalTwinConstants.dtPrefix} Start updating ${
            DigitalTwinConstants.productName} capability model with id:"${
            fileId}"...`);

        const result = await dtMetamodelRepositoryClient
                           .CreateOrUpdateCapabilityModelAsync(
                               fileContent, capabilityModelContext.etag,
                               builder.RepositoryIdValue);
        channel.appendLine(`${DigitalTwinConstants.dtPrefix} Submitting ${
            DigitalTwinConstants.productName} capability model: fileName: "${
            fileName}" successfully, capability model id: "${fileId}". `);
        vscode.window.showInformationMessage(
            `${DigitalTwinConstants.productName} capability model with id: "${
                fileId}" updated successfully`);
      } catch (error) {
        if (error.statusCode === 404)  // Not found
        {
          channel.appendLine(`${DigitalTwinConstants.dtPrefix} ${
              DigitalTwinConstants
                  .productName} capability model file does not exist in server, creating "${
              fileId}"... `);

          // Create the interface.
          const result = await dtMetamodelRepositoryClient
                             .CreateOrUpdateCapabilityModelAsync(
                                 fileContent, fileId, undefined,
                                 builder.RepositoryIdValue);
          channel.appendLine(`${DigitalTwinConstants.dtPrefix} Submitting ${
              DigitalTwinConstants.productName} capability model: fileName: "${
              fileName}" successfully, capability model id: "${fileId}". `);
          vscode.window.showInformationMessage(
              `${DigitalTwinConstants.productName} capability model with id: "${
                  fileId}" created successfully`);
        } else {
          throw error;
        }
      }
    } catch (error) {
      channel.appendLine(`${DigitalTwinConstants.dtPrefix} Submitting ${
          DigitalTwinConstants.productName} capability model: fileName: "${
          fileName}" failed, error: ${error.message}.`);
      vscode.window.showWarningMessage(`Unable to submit ${
          DigitalTwinConstants.productName} capability model, error: ${
          error.message}`);
      return false;
    }

    return true;
  }
}
