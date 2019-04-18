// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';
import * as url from 'url';

import {VSCExpress} from 'vscode-express';
import {PnPFileNames, PnPConstants} from './PnPConstants';
import {PnPMetamodelRepositoryClient} from './pnp-api/PnPMetamodelRepositoryClient';
import * as utils from '../utils';
import {MetaModelType} from './pnp-api/DataContracts/PnPContext';
import {PnPConnector} from './PnPConnector';
import {DialogResponses} from '../DialogResponses';
import {ConfigHandler} from '../configHandler';
import {ConfigKey} from '../constants';
import {PnPConnectionStringBuilder} from './pnp-api/PnPConnectionStringBuilder';
import {PnPModel, PnPModelBase} from './pnp-api/DataContracts/PnPModel';

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
          'Select the folder that will contain your Digital Twin files:', {
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
        fileName => fileName.endsWith(PnPConstants.interfaceSuffix) ||
            fileName.endsWith(PnPConstants.capabilityModelSuffix));

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
      value: PnPFileNames.defaultInterfaceName,
      prompt: `Please input interface name here.`,
      ignoreFocusOut: true,
      validateInput: (interfaceName: string) => {
        if (!interfaceName) {
          return 'Please provide a valid interface name.';
        }
        if (!/\.interface\.json$/i.test(interfaceName)) {
          interfaceName += PnPConstants.interfaceSuffix;
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
        interfaceFileName += PnPConstants.interfaceSuffix;
      }
    }

    const targetInterface = path.join(rootPath, interfaceFileName);

    const interfaceTemplate = context.asAbsolutePath(path.join(
        PnPFileNames.resourcesFolderName, PnPFileNames.deviceModelFolderName,
        PnPFileNames.sampleInterfaceName));

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
          `Creating Digital Twin interface failed: ${error.message}`);
    }
    await vscode.commands.executeCommand(
        'vscode.openFolder', vscode.Uri.file(rootPath), false);

    await vscode.window.showTextDocument(vscode.Uri.file(targetInterface));

    vscode.window.showInformationMessage(`New Digital Twin interface ${
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
      value: PnPFileNames.defaultCapabilityModelName,
      prompt: `Please input capability model name here:`,
      ignoreFocusOut: true,
      validateInput: (capabilityModelName: string) => {
        if (!capabilityModelName) {
          return 'Please provide a valid capability model name.';
        }
        if (!/\.capabilitymodel\.json$/i.test(capabilityModelName)) {
          capabilityModelName += PnPConstants.capabilityModelSuffix;
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
        capabilityModelFileName += PnPConstants.capabilityModelSuffix;
      }
    }

    const targetCapabilityModel = path.join(rootPath, capabilityModelFileName);

    const capabilityModel = context.asAbsolutePath(path.join(
        PnPFileNames.resourcesFolderName, PnPFileNames.deviceModelFolderName,
        PnPFileNames.sampleCapabilityModelName));

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
      throw new Error(
          `Creating Digital Twin capability model failed: ${error.message}`);
    }

    await vscode.commands.executeCommand(
        'vscode.openFolder', vscode.Uri.file(rootPath), false);

    await vscode.window.showTextDocument(
        vscode.Uri.file(targetCapabilityModel));

    vscode.window.showInformationMessage(`New Digital Twin capability model ${
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
          new VSCExpress(context, 'pnpRepositoryViews');
      await DeviceModelOperator.vscexpress.open(
          'index.html?public', 'Digital Twin Repository', vscode.ViewColumn.Two,
          {retainContextWhenHidden: true, enableScripts: true});
      return true;
    }

    // Open Organizational Model repository
    let connectionString =
        ConfigHandler.get<string>(ConfigKey.pnpModelRepositoryKeyName);

    if (!connectionString) {
      const option: vscode.InputBoxOptions = {
        value: PnPConstants.repoConnectionStringTemplate,
        prompt:
            'Please input the connection string to the Digital Twin repository:',
        ignoreFocusOut: true
      };

      const repoConnectionString = await vscode.window.showInputBox(option);

      if (!repoConnectionString) {
        return false;
      } else {
        await ConfigHandler.update(
            ConfigKey.pnpModelRepositoryKeyName, repoConnectionString,
            vscode.ConfigurationTarget.Global);
        connectionString = repoConnectionString;
      }
    }

    const result =
        await PnPConnector.ConnectMetamodelRepository(connectionString);

    if (result) {
      DeviceModelOperator.vscexpress = DeviceModelOperator.vscexpress ||
          new VSCExpress(context, 'pnpRepositoryViews');
      await DeviceModelOperator.vscexpress.open(
          'index.html', 'Digital Twin Repository', vscode.ViewColumn.Two,
          {retainContextWhenHidden: true, enableScripts: true});
      return true;
    }
    return false;
  }

  async Disconnect() {
    await ConfigHandler.update(
        ConfigKey.pnpModelRepositoryKeyName, '',
        vscode.ConfigurationTarget.Global);
    if (DeviceModelOperator.vscexpress) {
      DeviceModelOperator.vscexpress.close('index.html');
    }
    const message = 'Sign out Digital Twin repository successfully';
    vscode.window.showInformationMessage(message);
  }


  async GetInterfaces(
      context: vscode.ExtensionContext, usePublicRepository: boolean,
      searchString = '', pageSize = 50, continueToken: string|null = null) {
    if (usePublicRepository) {
      const pnpMetamodelRepositoryClient =
          new PnPMetamodelRepositoryClient(null);

      const result = await pnpMetamodelRepositoryClient.SearchInterfacesAsync(
          searchString, continueToken, undefined, pageSize);
      return result;
    } else {
      const connectionString =
          ConfigHandler.get<string>(ConfigKey.pnpModelRepositoryKeyName);
      if (!connectionString) {
        vscode.window.showWarningMessage(
            'Failed to get interfaces from Digital Twin repository. Please sign out and sign in with a valid connection string.');
        return;
      }

      const builder = PnPConnectionStringBuilder.Create(connectionString);
      const pnpMetamodelRepositoryClient =
          new PnPMetamodelRepositoryClient(connectionString);
      const result = await pnpMetamodelRepositoryClient.SearchInterfacesAsync(
          searchString, continueToken, builder.RepositoryIdValue, pageSize);
      return result;
    }
  }

  async GetCapabilityModels(
      context: vscode.ExtensionContext, usePublicRepository: boolean,
      searchString = '', pageSize = 50, continueToken: string|null = null) {
    if (usePublicRepository) {
      const pnpMetamodelRepositoryClient =
          new PnPMetamodelRepositoryClient(null);

      const result =
          await pnpMetamodelRepositoryClient.SearchCapabilityModelsAsync(
              searchString, continueToken, undefined, pageSize);
      return result;
    } else {
      const connectionString =
          ConfigHandler.get<string>(ConfigKey.pnpModelRepositoryKeyName);
      if (!connectionString) {
        vscode.window.showWarningMessage(
            'Failed to get capability models from Digital Twin repository. Please sign out and sign in with a valid connection string.');
        return;
      }
      const pnpMetamodelRepositoryClient =
          new PnPMetamodelRepositoryClient(connectionString);
      const builder = PnPConnectionStringBuilder.Create(connectionString);
      const result =
          await pnpMetamodelRepositoryClient.SearchCapabilityModelsAsync(
              searchString, continueToken, builder.RepositoryIdValue, pageSize);
      return result;
    }
  }

  async DeletePnPFiles(
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
        ConfigHandler.get<string>(ConfigKey.pnpModelRepositoryKeyName);
    if (!connectionString) {
      vscode.window.showWarningMessage(
          'Failed to delete models from Digital Twin repository. Please sign out and sign in with a valid connection string.');
      return;  // TODO: delete from public model repository??
    }

    const pnpMetamodelRepositoryClient =
        new PnPMetamodelRepositoryClient(connectionString);
    const builder = PnPConnectionStringBuilder.Create(connectionString);
    for (const id of fileIds) {
      channel.appendLine(`${PnPConstants.pnpPrefix} Start deleting ${
          metaModelValue} with id ${id}.`);
      try {
        if (metaModelType === MetaModelType.Interface) {
          await pnpMetamodelRepositoryClient.DeleteInterfaceAsync(
              id, builder.RepositoryIdValue);
          channel.appendLine(
              `${PnPConstants.pnpPrefix} Deleting interface with id ${
                  id} completed.`);
        } else {
          await pnpMetamodelRepositoryClient.DeleteCapabilityModelAsync(
              id, builder.RepositoryIdValue);
          channel.appendLine(
              `${PnPConstants.pnpPrefix} Deleting capabilty model with id ${
                  id} completed.`);
        }
      } catch (error) {
        channel.appendLine(`${PnPConstants.pnpPrefix} Deleting ${
            metaModelValue} with id ${id} failed. Error: ${error.message}`);
      }
    }
  }

  async DownloadAndEditPnPFiles(
      fileIds: string[], metaModelValue: string, usePublicRepository: boolean,
      context: vscode.ExtensionContext, channel: vscode.OutputChannel) {
    channel.show();
    if (!fileIds || fileIds.length === 0) {
      channel.appendLine(
          `${PnPConstants.pnpPrefix} No Digital Twin models is selected.`);
      return;
    }

    const metaModelType: MetaModelType =
        MetaModelType[metaModelValue as keyof typeof MetaModelType];

    let suffix = PnPConstants.interfaceSuffix;
    if (metaModelType === MetaModelType.CapabilityModel) {
      suffix = PnPConstants.capabilityModelSuffix;
    }

    const rootPath = await this.InitializeFolder();
    if (!rootPath) {
      return;
    }

    let repositoryId: string|undefined = undefined;
    let connectionString: string|null = null;

    if (!usePublicRepository) {
      const repoConnectionString =
          ConfigHandler.get<string>(ConfigKey.pnpModelRepositoryKeyName);
      if (!repoConnectionString) {
        return;
      }
      connectionString = repoConnectionString;
      const builder = PnPConnectionStringBuilder.Create(connectionString);
      repositoryId = builder.RepositoryIdValue;
    }

    const pnpMetamodelRepositoryClient =
        new PnPMetamodelRepositoryClient(connectionString);

    for (const id of fileIds) {
      channel.appendLine(`${PnPConstants.pnpPrefix} Start getting ${
          metaModelValue} with id ${id}.`);
      let fileMetaData: PnPModel;
      try {
        if (metaModelType === MetaModelType.Interface) {
          fileMetaData = await pnpMetamodelRepositoryClient.GetInterfaceAsync(
              id, repositoryId, true);
        } else {
          fileMetaData =
              await pnpMetamodelRepositoryClient.GetCapabilityModelAsync(
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
          channel.appendLine(`${PnPConstants.pnpPrefix} Downloading ${
              metaModelValue} with id ${id} into ${candidateName} completed.`);
        }

      } catch (error) {
        channel.appendLine(`${PnPConstants.pnpPrefix} Downloading ${
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
    const pnpFiles = fs.listSync(rootPath);
    const fileItems: vscode.QuickPickItem[] = [];

    if (pnpFiles && pnpFiles.length > 0) {
      pnpFiles.forEach((filePath: string) => {
        const fileName = path.basename(filePath);
        if (fileName.endsWith(PnPConstants.interfaceSuffix) ||
            fileName.endsWith(PnPConstants.capabilityModelSuffix)) {
          fileItems.push({label: fileName, description: ''});
        }
      });
    }

    if (fileItems.length === 0) {
      const message =
          'No Digital Twin models found in current folder. Please select the folder that contains Digital Twin files and try again.';
      vscode.window.showWarningMessage(message);
      return false;
    }

    const selectedFiles = await vscode.window.showQuickPick(fileItems, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: 'Select Digital Twin models',
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
            ({label}) => path.basename(file.fileName) === label));

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
      return file.label.endsWith(PnPConstants.interfaceSuffix);
    });

    const capabilityModels = selectedFiles.filter(file => {
      return file.label.endsWith(PnPConstants.capabilityModelSuffix);
    });

    let connectionString =
        ConfigHandler.get<string>(ConfigKey.pnpModelRepositoryKeyName);
    if (!connectionString) {
      const option: vscode.InputBoxOptions = {
        value: PnPConstants.repoConnectionStringTemplate,
        prompt:
            'Please input the connection string to access the Digital Twin repository.',
        ignoreFocusOut: true
      };

      connectionString = await vscode.window.showInputBox(option);

      if (!connectionString) {
        return false;
      } else {
        const result =
            await PnPConnector.ConnectMetamodelRepository(connectionString);
        if (!result) {
          return false;
        }
      }
    }

    const pnpMetamodelRepositoryClient =
        new PnPMetamodelRepositoryClient(connectionString);
    const builder = PnPConnectionStringBuilder.Create(connectionString);

    let continueOnFailure = false;
    const option: SubmitOptions = {overwriteChoice: OverwriteChoice.Unknown};

    for (const fileItem of interfaceFiles) {
      channel.appendLine(
          `${PnPConstants.pnpPrefix} File to submit: ${fileItem.label}`);
      const filePath = path.join(rootPath, fileItem.label);
      const result = await this.SubmitInterface(
          option, pnpMetamodelRepositoryClient, builder, filePath,
          fileItem.label, channel);
      if (!result && !continueOnFailure) {
        const message = `${
            fileItem
                .label} was not submitted to Digital Twin Model Repository successfully, do you want to continue with rest files?`;
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
          `${PnPConstants.pnpPrefix} File to submit: ${fileItem.label}`);
      const filePath = path.join(rootPath, fileItem.label);
      const result = await this.SubmitCapabilityModel(
          option, pnpMetamodelRepositoryClient, builder, filePath,
          fileItem.label, channel);
      if (!result && !continueOnFailure) {
        const message = `${
            fileItem
                .label} was not submitted to Digital Twin Model Repository successfully, do you want to continue with rest files?`;
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
      pnpMetamodelRepositoryClient: PnPMetamodelRepositoryClient,
      builder: PnPConnectionStringBuilder, filePath: string, fileName: string,
      channel: vscode.OutputChannel): Promise<boolean> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');

      let fileId = '';
      try {
        const fileJson = JSON.parse(fileContent);
        fileId = fileJson[constants.idName];
      } catch (error) {
        channel.appendLine(`${PnPConstants.pnpPrefix} ${
            fileName} is not a valid Digital Twin model. Please modify the content and submit it again.`);
        vscode.window.showWarningMessage(`${
            fileName} is not a valid Digital Twin model. Please modify the content and submit it again.`);
        return false;
      }

      if (!fileId) {
        vscode.window.showWarningMessage(
            'Unable to find id from the Digital Twin interface file. Please provide a valid file.');
        return false;
      }
      channel.appendLine(`${PnPConstants.pnpPrefix} Load and parse file: "${
          fileName}" successfully.`);
      // check whether file exists in model repo, try to update the file.
      try {
        // First, get the file to retrieve the latest etag.
        channel.appendLine(`${
            PnPConstants
                .pnpPrefix} Connect to Digital Twin repository to check whether ${
            fileId} exists in server...`);
        const interfaceMetaData =
            await pnpMetamodelRepositoryClient.GetInterfaceAsync(
                fileId, builder.RepositoryIdValue, true);

        channel.appendLine(`${
            PnPConstants
                .pnpPrefix} Azure IoT Digital Twin interface file with id:"${
            fileId}" exists in server. `);

        if (option.overwriteChoice === OverwriteChoice.Unknown) {
          const msg = `The interface with id "${
              fileId}" already exists in the Digital Twin Repository, do you want to overwrite it?`;
          const result: vscode.MessageItem|undefined =
              await vscode.window.showInformationMessage(
                  msg, DialogResponses.all, DialogResponses.yes,
                  DialogResponses.no);
          if (result === DialogResponses.no) {
            channel.appendLine(`${
                PnPConstants
                    .pnpPrefix} Submitting Digital Twin interface cancelled.`);
            return false;
          } else if (result === DialogResponses.all) {
            option.overwriteChoice = OverwriteChoice.OverwriteAll;
          }
        }

        channel.appendLine(`${
            PnPConstants
                .pnpPrefix} Start updating Digital Twin interface with id:"${
            fileId}"... `);

        const updatedContext =
            await pnpMetamodelRepositoryClient.CreateOrUpdateInterfaceAsync(
                fileContent, interfaceMetaData.etag, undefined);
        channel.appendLine(`${
            PnPConstants
                .pnpPrefix} Submitting Azure IoT Digital Twin interface file: fileName: "${
            fileName}" successfully, interface id: "${fileId}". `);
        vscode.window.showInformationMessage(
            `Azure IoT Digital Twin interface with interface id: "${
                fileId}" updated successfully`);
      } catch (error) {
        if (error.statusCode === 404)  // Not found
        {
          channel.appendLine(`${
              PnPConstants
                  .pnpPrefix} Digital Twin interface file does not exist in server, creating ${
              fileId}... `);
          // Create the interface.
          const result: PnPModelBase =
              await pnpMetamodelRepositoryClient.CreateOrUpdateInterfaceAsync(
                  fileContent, undefined, builder.RepositoryIdValue);
          channel.appendLine(`${
              PnPConstants
                  .pnpPrefix} Submitting Digital Twin interface: fileName: "${
              fileName}" successfully, interface id: "${fileId}". `);
          vscode.window.showInformationMessage(
              `Digital Twin interface with interface id: "${
                  fileId}" created successfully`);
        } else {
          throw error;
        }
      }
    } catch (error) {
      channel.appendLine(`${
          PnPConstants
              .pnpPrefix} Submitting Digital Twin interface: fileName: "${
          fileName}" failed, error: ${error.message}.`);
      vscode.window.showWarningMessage(
          `Unable to submit Digital Twin interface, error: ${error.message}`);
      return false;
    }

    return true;
  }

  private async SubmitCapabilityModel(
      option: SubmitOptions,
      pnpMetamodelRepositoryClient: PnPMetamodelRepositoryClient,
      builder: PnPConnectionStringBuilder, filePath: string, fileName: string,
      channel: vscode.OutputChannel): Promise<boolean> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');

      let fileId = '';
      try {
        const fileJson = JSON.parse(fileContent);
        fileId = fileJson[constants.idName];
      } catch (error) {
        channel.appendLine(`${PnPConstants.pnpPrefix} ${
            fileName} is not a valid Digital Twin model. Please modify the content and submit it again.`);
        vscode.window.showWarningMessage(`${
            fileName} is not a valid Digital Twin model. Please modify the content and submit it again.`);
        return false;
      }

      if (!fileId) {
        vscode.window.showWarningMessage(
            'Unable to find id from the Digital Twin capability model file. Please provide a valid file');
        return false;
      }
      channel.appendLine(`${PnPConstants.pnpPrefix} Load and parse file: ${
          fileName} successfully.`);
      // check whether file exists in model repo, try to update the file.
      try {
        // First, get the file to retrieve the latest etag.
        channel.appendLine(`${
            PnPConstants
                .pnpPrefix} Connect to Azure IoT Digital Twin repository to check whether "${
            fileId}" exists in server...`);
        const capabilityModelContext =
            await pnpMetamodelRepositoryClient.GetCapabilityModelAsync(
                fileId, builder.RepositoryIdValue, true);

        if (option.overwriteChoice === OverwriteChoice.Unknown) {
          const msg = `The capability model with id "${
              fileId}" already exists in the Digital Twin Repository, do you want to overwrite it?`;
          const result: vscode.MessageItem|undefined =
              await vscode.window.showInformationMessage(
                  msg, DialogResponses.all, DialogResponses.yes,
                  DialogResponses.no);
          if (result === DialogResponses.no) {
            channel.appendLine(`${
                PnPConstants
                    .pnpPrefix} Submitting Digital Twin capability model cancelled.`);
            return false;
          } else if (result === DialogResponses.all) {
            option.overwriteChoice = OverwriteChoice.OverwriteAll;
          }
        }

        channel.appendLine(`${
            PnPConstants
                .pnpPrefix} Start updating Digital Twin capability model with id:"${
            fileId}"...`);

        const updatedContext = await pnpMetamodelRepositoryClient
                                   .CreateOrUpdateCapabilityModelAsync(
                                       fileContent, capabilityModelContext.etag,
                                       builder.RepositoryIdValue);
        channel.appendLine(`${
            PnPConstants
                .pnpPrefix} Submitting Digital Twin capability model: fileName: "${
            fileName}" successfully, capability model id: "${fileId}". `);
        vscode.window.showInformationMessage(
            `Digital Twin capability model with id: "${
                fileId}" updated successfully`);
      } catch (error) {
        if (error.statusCode === 404)  // Not found
        {
          channel.appendLine(`${
              PnPConstants
                  .pnpPrefix} Digital Twin capability model file does not exist in server, creating "${
              fileId}"... `);

          // Create the interface.
          const result: PnPModelBase =
              await pnpMetamodelRepositoryClient
                  .CreateOrUpdateCapabilityModelAsync(
                      fileContent, undefined, builder.RepositoryIdValue);
          channel.appendLine(`${
              PnPConstants
                  .pnpPrefix} Submitting Digital Twin capability model: fileName: "${
              fileName}" successfully, capability model id: "${fileId}". `);
          vscode.window.showInformationMessage(
              `Digital Twin capability model with id: "${
                  fileId}" created successfully`);
        } else {
          throw error;
        }
      }
    } catch (error) {
      channel.appendLine(`${
          PnPConstants
              .pnpPrefix} Submitting Digital Twin capability model: fileName: "${
          fileName}" failed, error: ${error.message}.`);
      vscode.window.showWarningMessage(
          `Unable to submit Digital Twin capability model, error: ${
              error.message}`);
      return false;
    }

    return true;
  }
}