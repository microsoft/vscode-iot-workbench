// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';
import {VSCExpress} from 'vscode-express';

import {PnPFileNames, PnPConstants} from './PnPConstants';
import {PnPMetamodelRepositoryClient} from './pnp-api/PnPMetamodelRepositoryClient';
import {PnPUri} from './pnp-api/Validator/PnPUri';
import * as utils from '../utils';
import {MetaModelType, PnPContext} from './pnp-api/DataContracts/PnPContext';
import {PnPConnector} from './PnPConnector';
import {DialogResponses} from '../DialogResponses';

const constants = {
  storedFilesInfoKeyName: 'StoredFilesInfo',
  idName: '@id',
  displayName: 'displayName'
};


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
          'Select the folder that will contain your Plug & Play files:', {
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
          `Creating Plug & Play interface failed: ${error.message}`);
    }
    await vscode.commands.executeCommand(
        'vscode.openFolder', vscode.Uri.file(rootPath), false);

    await vscode.window.showTextDocument(vscode.Uri.file(targetInterface));

    vscode.window.showInformationMessage(`New Plug & Play interface ${
        interfaceFileName} was created successfully`);
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
      prompt: `Please input capability model name here.`,
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
          `Creating Plug & Play capability model failed: ${error.message}`);
    }

    await vscode.commands.executeCommand(
        'vscode.openFolder', vscode.Uri.file(rootPath), false);

    await vscode.window.showTextDocument(
        vscode.Uri.file(targetCapabilityModel));

    vscode.window.showInformationMessage(`New Plug & Play capability model ${
        capabilityModelFileName} created successfully`);
    return;
  }

  async Connect(
      context: vscode.ExtensionContext,
      channel: vscode.OutputChannel): Promise<boolean> {
    let rootPath: string|null = null;
    rootPath = await this.InitializeFolder();
    if (!rootPath) {
      return false;
    }

    let connectionString =
        context.workspaceState.get<string>(PnPConstants.modelRepositoryKeyName);

    if (!connectionString) {
      const option: vscode.InputBoxOptions = {
        value: PnPConstants.repoConnectionStringTemplate,
        prompt:
            'Please input the connection string to the Plug & Play repository.',
        ignoreFocusOut: true
      };

      const repoConnectionString = await vscode.window.showInputBox(option);

      if (!repoConnectionString) {
        return false;
      } else {
        context.workspaceState.update(
            PnPConstants.modelRepositoryKeyName, repoConnectionString);
        connectionString = repoConnectionString;
      }
    }

    const result = await PnPConnector.ConnectMetamodelRepository(
        context, connectionString);

    if (result) {
      await vscode.commands.executeCommand(
          'vscode.openFolder', vscode.Uri.file(rootPath), false);
      DeviceModelOperator.vscexpress = DeviceModelOperator.vscexpress ||
          new VSCExpress(context, 'pnpRepositoryViews');
      await DeviceModelOperator.vscexpress.open(
          'index.html', 'Plug & Play Repositry', vscode.ViewColumn.Two,
          {retainContextWhenHidden: true, enableScripts: true});
      return true;
    }
    return false;
  }

  async Disconnect(context: vscode.ExtensionContext) {
    context.workspaceState.update(PnPConstants.modelRepositoryKeyName, '');
    const message =
        'Sign out Plug & Play repository successfully, please close the Plug & Play Repositry window.';
    vscode.window.showInformationMessage(message);

    // TODO: Close the window of open model repo UI
    // DeviceModelOperator.vscexpress.close('index.html');
  }


  async GetAllInterfaces(
      context: vscode.ExtensionContext, pageSize = 50,
      continueToken: string|null = null) {
    let connectionString =
        context.workspaceState.get<string>(PnPConstants.modelRepositoryKeyName);
    if (!connectionString) {
      const option: vscode.InputBoxOptions = {
        value: PnPConstants.repoConnectionStringTemplate,
        prompt:
            'Please input the connection string to the Plug & Play repository.',
        ignoreFocusOut: true
      };

      const repoConnectionString = await vscode.window.showInputBox(option);

      if (!repoConnectionString) {
        return [];
      } else {
        context.workspaceState.update(
            PnPConstants.modelRepositoryKeyName, repoConnectionString);
        connectionString = repoConnectionString;
      }
    }
    const pnpMetamodelRepositoryClient =
        new PnPMetamodelRepositoryClient(connectionString);
    const result = await pnpMetamodelRepositoryClient.GetAllInterfacesAsync(
        continueToken, pageSize);
    return result;
  }

  async GetAllCapabilities(
      context: vscode.ExtensionContext, pageSize = 50,
      continueToken: string|null = null) {
    let connectionString =
        context.workspaceState.get<string>(PnPConstants.modelRepositoryKeyName);
    if (!connectionString) {
      const option: vscode.InputBoxOptions = {
        value: PnPConstants.repoConnectionStringTemplate,
        prompt:
            'Please input the connection string to the Plug & Play repository.',
        ignoreFocusOut: true
      };

      const repoConnectionString = await vscode.window.showInputBox(option);

      if (!repoConnectionString) {
        return [];
      } else {
        context.workspaceState.update(
            PnPConstants.modelRepositoryKeyName, repoConnectionString);
        connectionString = repoConnectionString;
      }
    }
    const pnpMetamodelRepositoryClient =
        new PnPMetamodelRepositoryClient(connectionString);
    const result =
        await pnpMetamodelRepositoryClient.GetAllCapabilityModelsAsync(
            continueToken, pageSize);
    return result;
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
        context.workspaceState.get<string>(PnPConstants.modelRepositoryKeyName);
    if (!connectionString) {
      return;
    }

    const pnpMetamodelRepositoryClient =
        new PnPMetamodelRepositoryClient(connectionString);

    fileIds.forEach(async (id) => {
      channel.appendLine(`Start deleting ${metaModelValue} with id ${id}.`);
      try {
        if (metaModelType === MetaModelType.Interface) {
          await pnpMetamodelRepositoryClient.DeleteInterfaceByInterfaceIdAsync(
              PnPUri.Parse(id));
          channel.appendLine(`Deleting interface with id ${id} completed.`);
        } else {
          await pnpMetamodelRepositoryClient
              .DeleteCapabilityModelByCapabilityModelIdAsync(PnPUri.Parse(id));
          channel.appendLine(
              `Deleting capabilty model with id ${id} completed.`);
        }
      } catch (error) {
        channel.appendLine(`Deleting ${metaModelValue} with id ${
            id} failed. Error: ${error.message}`);
      }
    });
  }

  async PublishPnPFiles(
      fileIds: string[], metaModelValue: string,
      context: vscode.ExtensionContext, channel: vscode.OutputChannel) {
    channel.show();
    if (!fileIds || fileIds.length === 0) {
      channel.appendLine(`Please select the ${metaModelValue} to publish.`);
      return;
    }

    const metaModelType: MetaModelType =
        MetaModelType[metaModelValue as keyof typeof MetaModelType];

    const connectionString =
        context.workspaceState.get<string>(PnPConstants.modelRepositoryKeyName);
    if (!connectionString) {
      return;
    }

    const pnpMetamodelRepositoryClient =
        new PnPMetamodelRepositoryClient(connectionString);

    fileIds.forEach(async (id) => {
      channel.appendLine(`Start publishing ${metaModelValue} with id ${id}.`);
      try {
        if (metaModelType === MetaModelType.Interface) {
          await pnpMetamodelRepositoryClient.PublishInterfaceAsync(
              PnPUri.Parse(id));
          channel.appendLine(`Publishing interface with id ${id} completed.`);
        } else {
          await pnpMetamodelRepositoryClient.PublishCapabilityModelAsync(
              PnPUri.Parse(id));
          channel.appendLine(
              `Publishing capabilty model with id ${id} completed.`);
        }
      } catch (error) {
        channel.appendLine(`Publishing ${metaModelValue} with id ${
            id} failed. Error: ${error.message}`);
      }
    });
  }


  async DownloadAndEditPnPFiles(
      fileIds: string[], metaModelValue: string,
      context: vscode.ExtensionContext, channel: vscode.OutputChannel) {
    channel.show();
    if (!fileIds || fileIds.length === 0) {
      channel.appendLine('Please select the Plug & Play files to download.');
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

    const connectionString =
        context.workspaceState.get<string>(PnPConstants.modelRepositoryKeyName);
    if (!connectionString) {
      return;
    }

    const pnpMetamodelRepositoryClient =
        new PnPMetamodelRepositoryClient(connectionString);

    fileIds.forEach(async (id) => {
      channel.appendLine(`Start getting ${metaModelValue} with id ${id}.`);
      let fileContext: PnPContext;
      try {
        if (metaModelType === MetaModelType.Interface) {
          fileContext =
              await pnpMetamodelRepositoryClient.GetInterfaceByInterfaceIdAsync(
                  PnPUri.Parse(id));
        } else {
          fileContext =
              await pnpMetamodelRepositoryClient
                  .GetCapabilityModelByCapabilityModelIdAsync(PnPUri.Parse(id));
        }
        if (fileContext) {
          const fileJson = JSON.parse(fileContext.content);
          const displayName = fileJson[constants.displayName] ?
              fileJson[constants.displayName] :
              metaModelValue;
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
              path.join(rootPath, candidateName), fileContext.content);
          await vscode.window.showTextDocument(
              vscode.Uri.file(path.join(rootPath, candidateName)));
          channel.appendLine(`Downloading ${metaModelValue} with id ${
              id} into ${candidateName} completed.`);
        }

      } catch (error) {
        channel.appendLine(`Downloading ${metaModelValue} with id ${
            id} failed. Error: ${error.message}`);
      }
    });
    await vscode.commands.executeCommand(
        'vscode.openFolder', vscode.Uri.file(rootPath), false);
  }

  async SubmitMetaModelFile(
      context: vscode.ExtensionContext,
      channel: vscode.OutputChannel): Promise<boolean> {
    if (!vscode.workspace.workspaceFolders ||
        !vscode.workspace.workspaceFolders[0].uri.fsPath) {
      vscode.window.showWarningMessage(
          'No folder opened in current window. Please select a folder first');
      return false;
    }
    channel.show();
    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    // Get the file to submit:
    const pnpFiles = fs.listSync(rootPath);
    if (!pnpFiles || pnpFiles.length === 0) {
      const message =
          'Unable to find Plug & Play files in current folder. Please open the folder that contains Plug & Play files and try again.';
      vscode.window.showWarningMessage(message);
      return false;
    }

    const fileItems: vscode.QuickPickItem[] = [];
    pnpFiles.forEach((filePath: string) => {
      const fileName = path.basename(filePath);
      if (fileName.endsWith(PnPConstants.interfaceSuffix) ||
          fileName.endsWith(PnPConstants.capabilityModelSuffix)) {
        fileItems.push({label: fileName, description: ''});
      }
    });

    if (fileItems.length === 0) {
      vscode.window.showWarningMessage(
          'Unable to find Plug & Play files in current folder. Please open the folder that contains Plug & Play files and try again.');
      return false;
    }

    const fileSelection = await vscode.window.showQuickPick(fileItems, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: 'Select a Plug & Play file',
    });

    if (!fileSelection) {
      return false;
    }

    const metaModelType =
        fileSelection.label.endsWith(PnPConstants.interfaceSuffix) ?
        MetaModelType.Interface :
        MetaModelType.CapabilityModel;

    channel.appendLine(`File selected: ${fileSelection.label}`);
    const filePath = path.join(rootPath, fileSelection.label);

    let connectionString =
        context.workspaceState.get<string>(PnPConstants.modelRepositoryKeyName);
    if (!connectionString) {
      const option: vscode.InputBoxOptions = {
        value: PnPConstants.repoConnectionStringTemplate,
        prompt:
            'Please input the connection string to access the Plug & Play repository.',
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

    const pnpMetamodelRepositoryClient =
        new PnPMetamodelRepositoryClient(connectionString);
    // submit the file
    if (metaModelType === MetaModelType.Interface) {
      const result = await this.SubmitInterface(
          pnpMetamodelRepositoryClient, filePath, fileSelection.label, channel);
      return result;
    } else {
      const result = await this.SubmitCapabilityModel(
          pnpMetamodelRepositoryClient, filePath, fileSelection.label, channel);
      return result;
    }
  }

  private async SubmitInterface(
      pnpMetamodelRepositoryClient: PnPMetamodelRepositoryClient,
      filePath: string, fileName: string,
      channel: vscode.OutputChannel): Promise<boolean> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');

      let fileId = '';
      try {
        const fileJson = JSON.parse(fileContent);
        fileId = fileJson[constants.idName];
      } catch (error) {
        vscode.window.showWarningMessage(`${
            fileName} is not a valid json file. Please modify the content and submit it again.`);
        return false;
      }

      if (!fileId) {
        vscode.window.showWarningMessage(
            'Unable to find interface id from the interface file. Please provide a valid file.');
        return false;
      }
      channel.appendLine(`Load and parse file: ${fileName} successfully.`);
      // check whether file exists in model repo, try to update the file.
      try {
        // First, get the file to retrieve the latest etag.
        channel.appendLine(
            `Connect to Plug & Play repository to check ${fileId} exists...`);
        const interfaceContext =
            await pnpMetamodelRepositoryClient.GetInterfaceByInterfaceIdAsync(
                PnPUri.Parse(fileId));

        if (interfaceContext.published) {
          // already published, we should not update it.
          vscode.window.showWarningMessage(`Interface with interface id: ${
              fileId} is already published. You could not updated it.`);
          return false;
        }
        channel.appendLine(`Interface file with id:${fileId} exists... `);

        const msg = `The interface with id ${
            fileId} already exists in the Plug & Play Repository, do you want to overwrite it?`;
        const result: vscode.MessageItem|undefined =
            await vscode.window.showInformationMessage(
                msg, DialogResponses.yes, DialogResponses.no);

        if (result === DialogResponses.no) {
          channel.appendLine('Submit interface file cancelled.');
          return false;
        }
        channel.appendLine(`Updating interface with id:${fileId}... `);

        const interfaceTags =
            await this.GetTagsforDocuments(fileName, interfaceContext.tags);

        // Update the interface
        const pnpContext: PnPContext = {
          resourceId: interfaceContext.resourceId,
          content: fileContent,
          etag: interfaceContext.etag,
          tags: interfaceTags
        };
        const updatedContext =
            await pnpMetamodelRepositoryClient.UpdateInterface(pnpContext);
        channel.appendLine(`Submitting interface file: fileName: ${
            fileName} successfully, interface id: ${fileId}. `);
        vscode.window.showInformationMessage(
            `Interface with interface id: ${fileId} updated successfully`);
      } catch (error) {
        if (error.statusCode === 404)  // Not found
        {
          channel.appendLine(
              `Interface file does not exist, creating ${fileId}... `);
          // Create the interface.
          const interfaceTags = await this.GetTagsforDocuments(fileName);
          const pnpContext: PnPContext = {
            resourceId: '',
            content: fileContent,
            etag: '',
            tags: interfaceTags
          };
          const result: PnPContext =
              await pnpMetamodelRepositoryClient.CreateInterfaceAsync(
                  pnpContext);
          channel.appendLine(`Submitting interface: fileName: ${
              fileName} successfully, interface id: ${fileId}. `);
          vscode.window.showInformationMessage(
              `Interface with interface id: ${fileId} created successfully`);
        } else {
          throw error;
        }
      }
    } catch (error) {
      channel.appendLine(`Submitting interface: fileName: ${
          fileName} failed, error: ${error.message}.`);
      vscode.window.showWarningMessage(
          `Unable to submit the file, error: ${error.message}`);
      return false;
    }

    return true;
  }

  private async SubmitCapabilityModel(
      pnpMetamodelRepositoryClient: PnPMetamodelRepositoryClient,
      filePath: string, fileName: string,
      channel: vscode.OutputChannel): Promise<boolean> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');

      let fileId = '';
      try {
        const fileJson = JSON.parse(fileContent);
        fileId = fileJson[constants.idName];
      } catch (error) {
        vscode.window.showWarningMessage(`${
            fileName} is not a valid json file. Please modify the content and submit it again.`);
        return false;
      }

      if (!fileId) {
        vscode.window.showWarningMessage(
            'Unable to find id from the capability model file.');
        return false;
      }
      channel.appendLine(`Load and parse file: ${fileName} successfully.`);
      // check whether file exists in model repo, try to update the file.
      try {
        // First, get the file to retrieve the latest etag.
        channel.appendLine(
            `Connect to repository to check ${fileId} exists...`);
        const capabilityModelContext =
            await pnpMetamodelRepositoryClient
                .GetCapabilityModelByCapabilityModelIdAsync(
                    PnPUri.Parse(fileId));

        if (capabilityModelContext.published) {
          // already published, we should not update it.
          vscode.window.showWarningMessage(`Capability model file with id: ${
              fileId} is already published. You could not updated it.`);
          return false;
        }

        const msg = `The capability model with id ${
            fileId} already exists in the Plug & Play Repository, do you want to overwrite it?`;
        const result: vscode.MessageItem|undefined =
            await vscode.window.showInformationMessage(
                msg, DialogResponses.yes, DialogResponses.no);

        if (result === DialogResponses.no) {
          channel.appendLine('Submit capability model cancelled.');
          return false;
        }

        channel.appendLine(`Updating capability model with id:${fileId}...`);

        const capabilityModelTags = await this.GetTagsforDocuments(
            fileName, capabilityModelContext.tags);

        // Update the interface
        const pnpContext: PnPContext = {
          resourceId: capabilityModelContext.resourceId,
          content: fileContent,
          etag: capabilityModelContext.etag,
          tags: capabilityModelTags
        };
        const updatedContext =
            await pnpMetamodelRepositoryClient.UpdateCapabilityModelAsync(
                pnpContext);
        channel.appendLine(`Submitting capability model file: fileName: ${
            fileName} successfully, capability model id: ${fileId}. `);
        vscode.window.showInformationMessage(
            `Capability model with id: ${fileId} updated successfully`);
      } catch (error) {
        if (error.statusCode === 404)  // Not found
        {
          channel.appendLine(
              `Capability model file does not exist, creating ${fileId}... `);
          // Create the interface.
          const capabilityModelTags = await this.GetTagsforDocuments(fileName);
          const pnpContext: PnPContext = {
            resourceId: '',
            content: fileContent,
            etag: '',
            tags: capabilityModelTags
          };
          const result: PnPContext =
              await pnpMetamodelRepositoryClient.CreateCapabilityModelAsync(
                  pnpContext);
          channel.appendLine(`Submitting capability model: fileName: ${
              fileName} successfully, capability model id: ${fileId}. `);
          vscode.window.showInformationMessage(
              `Capability model with id: ${fileId} created successfully`);
        } else {
          throw error;
        }
      }
    } catch (error) {
      channel.appendLine(`Submitting capability model: fileName: ${
          fileName} failed, error: ${error.message}.`);
      vscode.window.showWarningMessage(
          `Unable to submit the file, error: ${error.message}`);
      return false;
    }

    return true;
  }

  private async GetTagsforDocuments(fileName: string, inputTags?: string[]):
      Promise<string[]|undefined> {
    let tags = '';
    if (inputTags && inputTags.length >= 0) {
      tags = inputTags.join(';');
    }

    const option: vscode.InputBoxOptions = {
      value: tags,
      prompt: `Please input the tags for ${fileName}, separate by ';'`,
      ignoreFocusOut: true
    };
    const result = await vscode.window.showInputBox(option);

    if (result) {
      return result.split(';');
    } else {
      return;
    }
  }
}