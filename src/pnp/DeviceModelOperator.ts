// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';

import {PnPFileNames} from './PnPConstants';
import * as utils from '../utils';

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
}