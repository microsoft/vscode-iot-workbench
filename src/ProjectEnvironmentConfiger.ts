// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as utils from './utils';

import {TelemetryContext, TelemetryWorker} from './telemetry';
import {FileNames, ScaffoldType, PlatformType, TemplateTag, EventNames} from './constants';
import {FileUtility} from './FileUtility';
import {ProjectTemplate, TemplatesType, TemplateFileInfo} from './Models/Interfaces/ProjectTemplate';
import {RemoteExtension} from './Models/RemoteExtension';
import * as UIUtility from './UIUtility';
import {open} from 'inspector';

const impor = require('impor')(__dirname);
const ioTWorkspaceProjectModule = impor('./Models/IoTWorkspaceProject') as
    typeof import('./Models/IoTWorkspaceProject');
const ioTContainerizedProjectModule =
    impor('./Models/IoTContainerizedProject') as
    typeof import('./Models/IoTContainerizedProject');

export class ProjectEnvironmentConfiger {
  // In default situation, configuration command will scaffold configutation
  // files for project and open the project in remote if it is a Embedded Linux
  // project(containerized Devex).
  async configureProjectEnvironment(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext,
      platform: PlatformType = PlatformType.Unknown, openInNewWindow = true) {
    // Only create project when not in remote environment
    const isLocal = RemoteExtension.checkLocalBeforeRunCommand(context);
    if (!isLocal) {
      return;
    }

    // If current window contains other project, open the created project in new
    // window.
    if (vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length > 0) {
      openInNewWindow = true;
    }

    if (!vscode.workspace.workspaceFolders) {
      const message =
          'No folder is currently open in Visual Studio Code. Please select a folder first.';
      vscode.window.showWarningMessage(message);
      return;
    }

    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    if (!rootPath) {
      const message =
          'Unable to find the folder for device model files. Please select a folder first.';
      vscode.window.showWarningMessage(message);
      return;
    }

    await vscode.window.withProgress(
        {
          title: 'Project environment configuration',
          location: vscode.ProgressLocation.Window,
        },
        async () => {
          const scaffoldType = ScaffoldType.Local;

          // Select platform if not specified
          if (platform === PlatformType.Unknown) {
            const platformSelection =
                await UIUtility.selectPlatform(scaffoldType, context);
            if (!platformSelection) {
              telemetryContext.properties.errorMessage =
                  'Platform selection cancelled.';
              telemetryContext.properties.result = 'Cancelled';
              return;
            } else {
              telemetryContext.properties.platform = platformSelection.label;
              platform = utils.getEnumKeyByEnumValue(
                  PlatformType, platformSelection.label);
            }
          }

          telemetryContext.properties.platform = platform;

          // Get template list json object
          const templateJsonFilePath = context.asAbsolutePath(path.join(
              FileNames.resourcesFolderName, FileNames.templatesFolderName,
              FileNames.templateFileName));
          const templateJsonFileString =
              await FileUtility.readFile(
                  scaffoldType, templateJsonFilePath, 'utf8') as string;
          const templateJson = JSON.parse(templateJsonFileString);
          if (!templateJson) {
            throw new Error('Fail to load template list.');
          }

          if (platform === PlatformType.Arduino) {
            const arduinoTaskName = 'Arduino Task';
            const res = await this.configureProjectEnv(
                context, channel, telemetryContext, scaffoldType, templateJson,
                rootPath, arduinoTaskName);
            if (!res) {
              return;
            }
          } else if (platform === PlatformType.EmbeddedLinux) {
            // Select container
            const containerSelection = await this.selectContainer(templateJson);
            if (!containerSelection) {
              telemetryContext.properties.errorMessage =
                  'Container selection cancelled.';
              telemetryContext.properties.result = 'Cancelled';
              return;
            } else {
              telemetryContext.properties.platform = containerSelection.label;
            }

            // Configure the selected container environment for the project
            const res = await this.configureProjectEnv(
                context, channel, telemetryContext, scaffoldType, templateJson,
                rootPath, containerSelection.label);
            if (!res) {
              return;
            }

            // Open project in remote
            if (openInNewWindow) {
              setTimeout(
                  () => vscode.commands.executeCommand(
                      'iotcube.openInContainer', rootPath),
                  500);
            }
          } else {
            throw new Error(`Unsupported Platform type!`);
          }

          const message =
              'Configuration is done. You can run \'Azure IoT Device Workbench: Compile Device Code\' command to compile device code';
          utils.channelShowAndAppendLine(channel, message);
          vscode.window.showInformationMessage(message);
        });

    return;
  }

  /**
   * Configure Arduino project: Add tasks.json file
   * Ask to overwrite if file already exists.
   * @returns true - configuration success. false - configuration cancel.
   */
  private async configureProjectEnv(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext, scaffoldType: ScaffoldType,
      templateJson: TemplatesType, rootPath: string,
      templateName: string): Promise<boolean> {
    const projectEnvTemplate =
        templateJson.templates.filter((template: ProjectTemplate) => {
          return (
              template.tag === TemplateTag.DevelopmentEnvironment &&
              template.name === templateName);
        });

    if (!projectEnvTemplate) {
      throw new Error(
          `Fail to fetch project development environmnet template files with path name ${
              templateName}.`);
    }

    const templateFolderName = projectEnvTemplate[0].path;

    const templateFolder = context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName,
        templateFolderName));
    const templateFilesInfo: TemplateFileInfo[] =
        await utils.getTemplateFilesInfo(templateFolder);

    // configure file
    for (const fileInfo of templateFilesInfo) {
      const res = await this.scaffoldConfigurationFile(
          channel, telemetryContext, scaffoldType, rootPath, fileInfo);
      if (!res) {
        return false;
      }
    }
    return true;
  }

  /**
   * ask to whether overwrite tasks.json file or not
   * @returns true - overwrite; false - not overwrite; undefined - cancel
   * selection.
   */
  private async askToOverwriteFile(fileName: string):
      Promise<boolean|undefined> {
    const overwriteTasksJsonOption: vscode.QuickPickItem[] = [];
    overwriteTasksJsonOption.push(
        {label: `Yes`, description: ''}, {label: `No`, description: ''});

    const overwriteSelection =
        await vscode.window.showQuickPick(overwriteTasksJsonOption, {
          ignoreFocusOut: true,
          placeHolder: `${fileName} already exists. Overwrite?`
        });

    if (overwriteSelection === undefined) {
      // Selection was cancelled
      return;
    }
    return overwriteSelection.label === 'Yes';
  }

  /**
   * Scaffold configuration file for project. If file already exists, ask to
   * overwrite it.
   * @returns true - successfully scaffold file; false - cancel configuration.
   */
  private async scaffoldConfigurationFile(
      channel: vscode.OutputChannel, telemetryContext: TelemetryContext,
      scaffoldType: ScaffoldType, rootPath: string,
      fileInfo: TemplateFileInfo): Promise<boolean> {
    const targetPath = path.join(rootPath, fileInfo.targetPath);
    if (!await FileUtility.directoryExists(scaffoldType, targetPath)) {
      await FileUtility.mkdirRecursively(scaffoldType, targetPath);
    }

    const targetFilePath = path.join(targetPath, fileInfo.fileName);
    // File exists.
    if (await FileUtility.fileExists(scaffoldType, targetFilePath)) {
      const fileOverwrite = await this.askToOverwriteFile(fileInfo.fileName);
      if (fileOverwrite === undefined || !fileOverwrite) {
        let message = '';
        if (fileOverwrite === undefined) {
          message =
              `Ask to overwrite ${fileInfo.fileName} selection cancelled.`;
        } else if (!fileOverwrite) {
          message = `Not overwrite original ${
              fileInfo.fileName}. Configuration operation cancelled.`;
        }
        utils.channelShowAndAppendLine(channel, message);

        telemetryContext.properties.errorMessage = message;
        telemetryContext.properties.result = 'Cancelled';
        return false;
      }
    }

    // File not exists or choose to overwrite it.
    if (!fileInfo.fileContent) {
      throw new Error(`Fail to load ${fileInfo.fileName}.`);
    }

    await FileUtility.writeFile(
        scaffoldType, targetFilePath, fileInfo.fileContent);
    return true;
  }

  private async selectContainer(templateListJson: TemplatesType):
      Promise<vscode.QuickPickItem|undefined> {
    const containerTemplates =
        templateListJson.templates.filter((template: ProjectTemplate) => {
          return (template.tag === TemplateTag.DevelopmentEnvironment);
        });

    const containerList: vscode.QuickPickItem[] = [];
    containerTemplates.forEach((container: ProjectTemplate) => {
      containerList.push(
          {label: container.name, description: container.description});
    });

    const containerSelection =
        await vscode.window.showQuickPick(containerList, {
          ignoreFocusOut: true,
          matchOnDescription: true,
          matchOnDetail: true,
          placeHolder: 'Select a platform',
        });

    return containerSelection;
  }
}