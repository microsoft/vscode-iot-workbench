// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';

import {PnPFileNames, PnPConstants} from './PnPConstants';
import {PnPMetamodelRepositoryClient} from './pnp-api/PnPMetamodelRepositoryClient';
import {PnPUri} from './pnp-api/Validator/PnPUri';
import * as utils from '../utils';
import {MetaModelType, PnPContext} from './pnp-api/DataContracts/PnPContext';
import {PnPConnector} from './PnPConnector';

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
          'Select the folder that will contain your PnP files:', {
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

  async Load(
      rootPath: string, context: vscode.ExtensionContext,
      channel: vscode.OutputChannel): Promise<boolean> {
    if (!rootPath) {
      return false;
    }

    const files = fs.listSync(rootPath);

    const deviceModelFile = files.find(
        fileName => fileName.endsWith('.template.json') ||
            fileName.endsWith('.interface.json'));

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
        if (/^([a-z_]|[a-z_][-a-z0-9_.]*[a-z0-9_])(\.interface\.json)?$/i.test(
                interfaceName)) {
          if (!/\.interface\.json$/i.test(interfaceName)) {
            interfaceName += '.interface.json';
          }
          const targetInterface = path.join(rootPath as string, interfaceName);
          if (fs.existsSync(targetInterface)) {
            return 'The file name specified already exists in the device model.';
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
        interfaceFileName += '.interface.json';
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
      throw new Error(`Create sample interface file failed: ${error.message}`);
    }
    await vscode.commands.executeCommand(
        'vscode.openFolder', vscode.Uri.file(rootPath), false);

    vscode.window.showInformationMessage('Interface created successfully');
    return;
  }

  async CreateTemplate(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel) {
    let rootPath: string|null = null;
    rootPath = await this.InitializeFolder();
    if (!rootPath) {
      return;
    }

    const option: vscode.InputBoxOptions = {
      value: PnPFileNames.defaultTemplateName,
      prompt: `Please input template name here.`,
      ignoreFocusOut: true,
      validateInput: (templateName: string) => {
        if (!templateName) {
          return 'Please provide a valid template name.';
        }
        if (/^([a-z_]|[a-z_][-a-z0-9_.]*[a-z0-9_])(\.template\.json)?$/i.test(
                templateName)) {
          if (!/\.template\.json$/i.test(templateName)) {
            templateName += '.template.json';
          }
          const targetTemplate = path.join(rootPath as string, templateName);
          if (fs.existsSync(targetTemplate)) {
            return 'The file name specified already exists in the device model.';
          }
          return '';
        }
        return 'Template name can only contain alphanumeric and cannot start with number.';
      }
    };

    let templateFileName = await vscode.window.showInputBox(option);

    if (templateFileName === undefined) {
      return false;
    } else {
      templateFileName = templateFileName.trim();
      if (!/\.template\.json$/i.test(templateFileName)) {
        templateFileName += '.template.json';
      }
    }

    const targetTemplate = path.join(rootPath, templateFileName);

    const template = context.asAbsolutePath(path.join(
        PnPFileNames.resourcesFolderName, PnPFileNames.deviceModelFolderName,
        PnPFileNames.sampleTemplateName));

    try {
      const content = fs.readFileSync(template, 'utf8');
      const templateNamePattern = /{TEMPLATENAME}/g;
      const matchItems = templateFileName.match(/^(.*?)\.(template)\.json$/);
      if (!matchItems || !matchItems[1]) {
        return false;
      }
      const replaceStr = content.replace(templateNamePattern, matchItems[1]);
      fs.writeFileSync(targetTemplate, replaceStr);
    } catch (error) {
      throw new Error(`Create sample template file failed: ${error.message}`);
    }

    await vscode.commands.executeCommand(
        'vscode.openFolder', vscode.Uri.file(rootPath), false);

    vscode.window.showInformationMessage('Template created successfully');
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

    const option: vscode.InputBoxOptions = {
      value: PnPConstants.repoConnectionStringTemplate,
      prompt:
          `Please input the connection string to access the model repository.`,
      ignoreFocusOut: true
    };

    const repoConnectionString = await vscode.window.showInputBox(option);

    if (!repoConnectionString) {
      return false;
    }

    const result = await PnPConnector.ConnectMetamodelRepository(
        context, repoConnectionString);

    if (result) {
      await vscode.commands.executeCommand(
          'vscode.openFolder', vscode.Uri.file(rootPath), false);
      return true;
    }
    return false;
  }

  async SubmitMetaModelFile(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      metaModelType: MetaModelType): Promise<boolean> {
    if (!vscode.workspace.workspaceFolders ||
        !vscode.workspace.workspaceFolders[0].uri.fsPath) {
      vscode.window.showWarningMessage(
          'No folder opened in current window. Please select a folder first');
      return false;
    }
    channel.show();
    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    // Get the file to submit:
    const templateFiles = fs.listSync(rootPath);
    if (!templateFiles || templateFiles.length === 0) {
      const message = 'Unable to find meta model files in the folder.';
      vscode.window.showWarningMessage(message);
      return false;
    }

    const suffix = metaModelType === MetaModelType.Interface ?
        '.interface.json' :
        '.template.json';

    const templateItems: vscode.QuickPickItem[] = [];
    templateFiles.forEach((filePath: string) => {
      const fileName = path.basename(filePath);
      if (fileName.endsWith(suffix)) {
        templateItems.push({label: fileName, description: ''});
      }
    });

    if (templateItems.length === 0) {
      vscode.window.showWarningMessage(
          'Unable to find the target metamodel files. Please make sure meta model files exists in the target folder.');
      return false;
    }

    const fileSelection = await vscode.window.showQuickPick(templateItems, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: 'Select a Plug & Play meta model file',
    });

    if (!fileSelection) {
      return false;
    }
    channel.appendLine(`File selected: ${fileSelection.label}`);
    const filePath = path.join(rootPath, fileSelection.label);

    let connectionString =
        context.workspaceState.get<string>(PnPConstants.modelRepositoryKeyName);
    if (!connectionString) {
      const option: vscode.InputBoxOptions = {
        value: PnPConstants.repoConnectionStringTemplate,
        prompt:
            `Please input the connection string to access the model repository.`,
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
      const result = await this.SubmitTemplate(
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
      const fileJson = JSON.parse(fileContent);
      const fileId = fileJson[constants.idName];
      if (!fileId) {
        vscode.window.showWarningMessage(
            'Unable to find interface id from the interface file.');
        return false;
      }
      channel.appendLine(`Load and parse file: ${fileName} successfully.`);
      // check whether file exists in model repo, try to update the file.
      try {
        // First, get the file to retrieve the latest etag.
        channel.appendLine(
            `Connect to repository to check ${fileId} exists...`);
        const interfaceContext =
            await pnpMetamodelRepositoryClient.GetInterfaceByInterfaceIdAsync(
                PnPUri.Parse(fileId));

        if (interfaceContext.published) {
          // already published, we should not update it.
          vscode.window.showWarningMessage(`Interface with interface id: ${
              fileId} is already published. You could not updated it.`);
          return false;
        }
        channel.appendLine(`Interface file exists, updating ${fileId}... `);

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
          fileName} failed, error: ${error}.`);
      vscode.window.showWarningMessage(
          `Unable to submit the file, error: ${error}`);
      return false;
    }

    return true;
  }

  private async SubmitTemplate(
      pnpMetamodelRepositoryClient: PnPMetamodelRepositoryClient,
      filePath: string, fileName: string,
      channel: vscode.OutputChannel): Promise<boolean> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const fileJson = JSON.parse(fileContent);
      const fileId = fileJson[constants.idName];
      if (!fileId) {
        vscode.window.showWarningMessage(
            'Unable to find template id from the template file.');
        return false;
      }
      channel.appendLine(`Load and parse file: ${fileName} successfully.`);
      // check whether file exists in model repo, try to update the file.
      try {
        // First, get the file to retrieve the latest etag.
        channel.appendLine(
            `Connect to repository to check ${fileId} exists...`);
        const templateContext =
            await pnpMetamodelRepositoryClient.GetTemplateByTemplateIdAsync(
                PnPUri.Parse(fileId));

        if (templateContext.published) {
          // already published, we should not update it.
          vscode.window.showWarningMessage(`Template with template id: ${
              fileId} is already published. You could not updated it.`);
          return false;
        }

        channel.appendLine(`Template file exists, updating ${fileId}... `);

        const templateTags =
            await this.GetTagsforDocuments(fileName, templateContext.tags);

        // Update the interface
        const pnpContext: PnPContext = {
          resourceId: templateContext.resourceId,
          content: fileContent,
          etag: templateContext.etag,
          tags: templateTags
        };
        const updatedContext =
            await pnpMetamodelRepositoryClient.UpdateTemplate(pnpContext);
        channel.appendLine(`Submitting template file: fileName: ${
            fileName} successfully, template id: ${fileId}. `);
        vscode.window.showInformationMessage(
            `Template with template id: ${fileId} updated successfully`);
      } catch (error) {
        if (error.statusCode === 404)  // Not found
        {
          channel.appendLine(
              `Template file does not exist, creating ${fileId}... `);
          // Create the interface.
          const templateTags = await this.GetTagsforDocuments(fileName);
          const pnpContext: PnPContext = {
            resourceId: '',
            content: fileContent,
            etag: '',
            tags: templateTags
          };
          const result: PnPContext =
              await pnpMetamodelRepositoryClient.CreateTemplateAsync(
                  pnpContext);
          channel.appendLine(`Submitting template: fileName: ${
              fileName} successfully, template id: ${fileId}. `);
          vscode.window.showInformationMessage(
              `Template with template id: ${fileId} created successfully`);
        } else {
          throw error;
        }
      }
    } catch (error) {
      channel.appendLine(`Submitting template: fileName: ${
          fileName} failed, error: ${error}.`);
      vscode.window.showWarningMessage(
          `Unable to submit the file, error: ${error}`);
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
      prompt: `Please input the tags of ${fileName}, separate by ';'`,
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