// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';

import {ConfigKey, FileNames} from '../constants';
import {PnPFileNames} from './PnPConstants';
import {ConfigHandler} from '../configHandler';
import {Workspace} from '../Models/Interfaces/Workspace';

export class DeviceModelOperator {
  // Initial the folder for authoring device model, return the root path of the
  // workspace
  private async Initialize(
      context: vscode.ExtensionContext,
      channel: vscode.OutputChannel): Promise<string|null> {
    let rootPath: string;
    if (!vscode.workspace.workspaceFolders) {
      // Create a folder and select it as the root path
      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: 'Select an empty folder to start',
        canSelectFolders: true,
        canSelectFiles: false
      };
      const folderUri = await vscode.window.showOpenDialog(options);
      if (folderUri && folderUri[0]) {
        console.log(`Selected folder: ${folderUri[0].fsPath}`);
        rootPath = folderUri[0].fsPath;
      } else {
        return null;
      }
    } else {
      rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    // if the selected folder is not empty, ask user to select another one.
    const files = fs.readdirSync(rootPath);
    if (files && files[0]) {
      const message =
          'An empty folder is required to initialize the project. Please use an empty folder.';
      vscode.window.showWarningMessage(message);
      return null;
    }

    // Initial project
    await vscode.window.withProgress(
        {
          title: 'Device model initialization',
          location: vscode.ProgressLocation.Window,
        },
        async (progress) => {
          progress.report({
            message: 'Initialize the folder for device model',
          });

          try {
            // step 1: Initialize the workspace file
            const workspace: Workspace = {folders: [], settings: {}};

            const deviceModelDir =
                path.join(rootPath, PnPFileNames.deviceModelFolderName);

            if (!fs.existsSync(deviceModelDir)) {
              fs.mkdirSync(deviceModelDir);
            }

            workspace.folders.push({path: PnPFileNames.deviceModelFolderName});
            workspace.settings[`IoTWorkbench.${ConfigKey.pnpDeviceModelPath}`] =
                PnPFileNames.deviceModelFolderName;

            // step 2: Copy json schema file
            const intefaceSchemaFile = context.asAbsolutePath(path.join(
                PnPFileNames.resourcesFolderName,
                PnPFileNames.deviceModelFolderName,
                PnPFileNames.interfaceSchemaFileName));

            const templateSchemaFile = context.asAbsolutePath(path.join(
                PnPFileNames.resourcesFolderName,
                PnPFileNames.deviceModelFolderName,
                PnPFileNames.templateSchemaFileName));

            const schemaFolderPath =
                path.join(deviceModelDir, PnPFileNames.schemaFolderName);
            if (!fs.existsSync(schemaFolderPath)) {
              fs.mkdirSync(schemaFolderPath);
            }

            const targetInterfaceSchema = path.join(
                schemaFolderPath, PnPFileNames.interfaceSchemaFileName);
            const targetTemplateSchema = path.join(
                schemaFolderPath, PnPFileNames.templateSchemaFileName);

            try {
              const interfaceContent =
                  fs.readFileSync(intefaceSchemaFile, 'utf8');
              fs.writeFileSync(targetInterfaceSchema, interfaceContent);
              const templateContent =
                  fs.readFileSync(templateSchemaFile, 'utf8');
              fs.writeFileSync(targetTemplateSchema, templateContent);
            } catch (error) {
              throw new Error(`Create schema file failed: ${error.message}`);
            }

            // step 3: Update the user settings for json schema
            const vscodeFolderPath = path.join(
                deviceModelDir, PnPFileNames.vscodeSettingsFolderName);

            if (!fs.existsSync(vscodeFolderPath)) {
              fs.mkdirSync(vscodeFolderPath);
            }

            const settingsJSONFilePath =
                path.join(vscodeFolderPath, PnPFileNames.settingsJsonFileName);
            const settingsJSONObj = {
              'json.schemas': [
                {
                  'fileMatch': ['/*.interface.json'],
                  'url': './schemas/interface.schema.json'
                },
                {
                  'fileMatch': ['/*.template.json'],
                  'url': './schemas/template.schema.json'
                }
              ]
            };

            try {
              fs.writeFileSync(
                  settingsJSONFilePath,
                  JSON.stringify(settingsJSONObj, null, 4));
            } catch (error) {
              throw new Error(
                  `Device: create user setting file failed: ${error.message}`);
            }

            const workspaceConfigFilePath =
                path.join(rootPath, FileNames.workspaceConfigFilePath);

            fs.writeFileSync(
                workspaceConfigFilePath, JSON.stringify(workspace, null, 4));

          } catch (error) {
            throw error;
          }
        });
    return rootPath;
  }

  async CreateInterface(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel) {
    let rootPath: string|null = null;
    let needInitialize = false;

    if (!this.validateDeviceModel(context)) {
      rootPath = await this.Initialize(context, channel);
      if (rootPath) {
        needInitialize = true;
      }
    } else {
      if (vscode.workspace.workspaceFolders) {
        rootPath =
            path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '..');
      }
    }

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
          const targetInterface = path.join(
              rootPath as string, PnPFileNames.deviceModelFolderName,
              interfaceName);
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

    const targetInterface = path.join(
        rootPath, PnPFileNames.deviceModelFolderName, interfaceFileName);

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
    vscode.window.showInformationMessage('Interface created successfully');

    if (needInitialize) {
      const workspaceConfigFilePath =
          path.join(rootPath, FileNames.workspaceConfigFilePath);
      try {
        setTimeout(
            () => vscode.commands.executeCommand(
                'vscode.openFolder', vscode.Uri.file(workspaceConfigFilePath),
                false),
            1000);
        return true;
      } catch (error) {
        throw error;
      }
    }
    return;
  }

  async CreateTemplate(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel) {
    let rootPath: string|null = null;
    let needInitialize = false;

    if (!this.validateDeviceModel(context)) {
      rootPath = await this.Initialize(context, channel);
      if (rootPath) {
        needInitialize = true;
      }
    } else {
      if (vscode.workspace.workspaceFolders) {
        rootPath =
            path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '..');
      }
    }

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
          const targetTemplate = path.join(
              rootPath as string, PnPFileNames.deviceModelFolderName,
              templateName);
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

    const targetTemplate = path.join(
        rootPath, PnPFileNames.deviceModelFolderName, templateFileName);

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
    vscode.window.showInformationMessage('Template created successfully');
    if (needInitialize) {
      const workspaceConfigFilePath =
          path.join(rootPath, FileNames.workspaceConfigFilePath);
      try {
        setTimeout(
            () => vscode.commands.executeCommand(
                'vscode.openFolder', vscode.Uri.file(workspaceConfigFilePath),
                false),
            1000);
        return true;
      } catch (error) {
        throw error;
      }
    }
    return;
  }

  private validateDeviceModel(context: vscode.ExtensionContext): boolean {
    let rootPath: string;
    if (!vscode.workspace.workspaceFolders) {
      return false;
    }

    const pnpDeviceModelPath =
        ConfigHandler.get<string>(ConfigKey.pnpDeviceModelPath);
    if (!pnpDeviceModelPath) {
      return false;
    }

    rootPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '..');

    const deviceModelLocation = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath, '..',
        pnpDeviceModelPath);

    if (!fs.existsSync(deviceModelLocation)) {
      return false;
    }

    const schemaPath = path.join(
        deviceModelLocation, PnPFileNames.schemaFolderName,
        PnPFileNames.interfaceSchemaFileName);
    if (!fs.existsSync(schemaPath)) {
      return false;
    }
    return true;
  }
}