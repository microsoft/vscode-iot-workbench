// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as utils from './utils';

import {TelemetryContext} from './telemetry';
import {FileNames, ScaffoldType, PlatformType, TemplateTag} from './constants';
import {FileUtility} from './FileUtility';
import {ProjectTemplate, TemplatesType, TemplateFileInfo} from './Models/Interfaces/ProjectTemplate';
import {RemoteExtension} from './Models/RemoteExtension';
import * as UIUtility from './UIUtility';
import {CancelOperationError} from './CancelOperationError';
import {IoTWorkbenchProjectBase} from './Models/IoTWorkbenchProjectBase';
import {ProjectHostType} from './Models/Interfaces/ProjectHostType';

const impor = require('impor')(__dirname);
const ioTWorkspaceProjectModule = impor('./Models/IoTWorkspaceProject') as
    typeof import('./Models/IoTWorkspaceProject');
const ioTContainerizedProjectModule =
    impor('./Models/IoTContainerizedProject') as
    typeof import('./Models/IoTContainerizedProject');

enum OverwriteLabel {
  No = 'No',
  YesToAll = 'Yes to all'
}
export class ProjectEnvironmentConfiger {
  async configureProjectEnvironment(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    // Only create project when not in remote environment
    const isLocal = RemoteExtension.checkLocalBeforeRunCommand(context);
    if (!isLocal) {
      return;
    }

    if (!(vscode.workspace.workspaceFolders &&
          vscode.workspace.workspaceFolders.length > 0)) {
      const message =
          'You have not yet opened a folder in Visual Studio Code. Please select a folder first.';
      vscode.window.showWarningMessage(message);
      return;
    }

    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    await vscode.window.withProgress(
        {
          title: 'Project environment configuration',
          location: vscode.ProgressLocation.Window,
        },
        async () => {
          // Select platform if not specified
          const platformSelection =
              await UIUtility.selectPlatform(ScaffoldType.Local, context);
          let platform: PlatformType;
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

          if (platform === PlatformType.Arduino) {
            // First ensure the project is correctly open.
            await utils.constructAndLoadIoTProject(
                context, channel, telemetryContext);

            // Check platform validation.
            // Only iot workbench Arduino project created by workbench extension
            // can be configured as Arduino platform(for upgrade).
            const projectHostType =
                await IoTWorkbenchProjectBase.getProjectType(
                    ScaffoldType.Workspace, rootPath);
            if (projectHostType !== ProjectHostType.Workspace) {
              const message =
                  `This is not an iot workbench Arduino projects. You cannot configure it as Arduino platform.`;
              utils.channelShowAndAppendLine(channel, message);
              vscode.window.showInformationMessage(message);
              return;
            }
          }

          this.configureProjectEnvironmentCore(
              context, channel, telemetryContext, rootPath, platform, false);
        });

    return;
  }

  /**
   * Configuration operation adds configutation files for project.
   * For Embedded Linux project, ask user whether to customize environment. If
   * not, open Embedded Linux project in remote.
   * @param projectPath For Arduino project, projectPath is the Device directory
   */
  async configureProjectEnvironmentCore(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext, projectPath: string,
      platform: PlatformType, openInNewWindow = false) {
    telemetryContext.properties.platform = platform;

    if (!projectPath) {
      throw new Error(
          'Unable to find the project path, please open the folder and initialize project again.');
    }

    const scaffoldType = ScaffoldType.Local;

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

    let project;
    let templateName: string;
    if (platform === PlatformType.EmbeddedLinux) {
      project = new ioTContainerizedProjectModule.IoTContainerizedProject(
          context, channel, telemetryContext);

      // Select container
      const containerSelection = await this.selectContainer(templateJson);
      if (!containerSelection) {
        telemetryContext.properties.errorMessage =
            'Container selection cancelled.';
        telemetryContext.properties.result = 'Cancelled';
        return;
      }
      templateName = containerSelection.label;
      if (!templateName) {
        throw new Error(
            `Internal Error: Cannot get template name from template property.`);
      }
    } else if (platform === PlatformType.Arduino) {
      project = new ioTWorkspaceProjectModule.IoTWorkspaceProject(
          context, channel, telemetryContext);
      templateName = 'Arduino Task';

    } else {
      throw new Error(`Unsupported Platform type!`);
    }

    telemetryContext.properties.templateName = templateName;

    // Get environment template files
    const projectEnvTemplate: ProjectTemplate[] =
        templateJson.templates.filter((template: ProjectTemplate) => {
          return (
              template.tag === TemplateTag.DevelopmentEnvironment &&
              template.name === templateName);
        });
    if (!(projectEnvTemplate && projectEnvTemplate.length > 0)) {
      throw new Error(
          `Fail to get project development environment template files.`);
    }
    const templateFolderName = projectEnvTemplate[0].path;
    const templateFolder = context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName,
        templateFolderName));
    const templateFilesInfo: TemplateFileInfo[] =
        await utils.getTemplateFilesInfo(templateFolder);

    // Step 3: Ask overwrite or not
    let overwriteAll = false;
    try {
      overwriteAll = await this.askToOverwrite(
          scaffoldType, projectPath, templateFilesInfo);
    } catch (error) {
      if (error instanceof CancelOperationError) {
        telemetryContext.properties.result = 'Cancelled';
        telemetryContext.properties.errorMessage = error.message;
        return;
      } else {
        throw error;
      }
    }
    if (!overwriteAll) {
      const message =
          'Do not overwrite configuration files and cancel configuration process.';
      telemetryContext.properties.errorMessage = message;
      telemetryContext.properties.result = 'Cancelled';
      return;
    }

    // Step 4: Configure project environment with template files
    await project.configureProjectEnv(
        channel, telemetryContext, scaffoldType, projectPath, templateFilesInfo,
        openInNewWindow);
  }

  /**
   * If there is configuration file already exists, ask to overwrite all or
   * cancel configuration.
   */
  private async askToOverwrite(
      scaffoldType: ScaffoldType, projectPath: string,
      templateFilesInfo: TemplateFileInfo[]): Promise<boolean> {
    // Check whether configuration file exists
    for (const fileInfo of templateFilesInfo) {
      const targetFilePath =
          path.join(projectPath, fileInfo.targetPath, fileInfo.fileName);
      if (await FileUtility.fileExists(scaffoldType, targetFilePath)) {
        const fileOverwrite = await this.askToOverwriteFile(fileInfo.fileName);

        return fileOverwrite.label === OverwriteLabel.YesToAll;
      }
    }

    // No files exist, overwrite directly.
    return true;
  }

  /**
   * Ask whether to overwrite all configuration files
   */
  private async askToOverwriteFile(fileName: string):
      Promise<vscode.QuickPickItem> {
    const overwriteTasksJsonOption: vscode.QuickPickItem[] = [];
    overwriteTasksJsonOption.push(
        {
          label: OverwriteLabel.No,
          detail:
              'Do not overwrite existed file and cancel the configuration process.'
        },
        {
          label: OverwriteLabel.YesToAll,
          detail: 'Automatically overwrite all configuration files.'
        });

    const overwriteSelection =
        await vscode.window.showQuickPick(overwriteTasksJsonOption, {
          ignoreFocusOut: true,
          placeHolder: `Configuration file ${
              fileName} already exists. Do you want to overwrite all existed configuration files or cancel the configuration process?`
        });

    if (overwriteSelection === undefined) {
      // Selection was cancelled
      throw new CancelOperationError(
          `Ask to overwrite ${fileName} selection cancelled.`);
    }

    return overwriteSelection;
  }

  private async selectContainer(templateListJson: TemplatesType):
      Promise<vscode.QuickPickItem|undefined> {
    const containerTemplates =
        templateListJson.templates.filter((template: ProjectTemplate) => {
          return (
              template.tag === TemplateTag.DevelopmentEnvironment &&
              template.platform === PlatformType.EmbeddedLinux);
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