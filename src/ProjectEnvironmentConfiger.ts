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

const impor = require('impor')(__dirname);
const ioTWorkspaceProjectModule = impor('./Models/IoTWorkspaceProject') as
    typeof import('./Models/IoTWorkspaceProject');
const ioTContainerizedProjectModule =
    impor('./Models/IoTContainerizedProject') as
    typeof import('./Models/IoTContainerizedProject');

enum OverwriteLabel {
  Yes = 'Yes',
  No = 'No',
  YesToAll = 'Yes to all'
}
export class ProjectEnvironmentConfiger {
  // Configuration command will scaffold configutation
  // files for project and WILL NOT open an Embedded Linux project in remote by
  // default.
  async configureProjectEnvironment(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext,
      platform: PlatformType = PlatformType.Unknown, openInNewWindow = false) {
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
            const templateName = 'Arduino Task';

            try {
              await this.configureProjectEnv(
                  context, scaffoldType, templateJson, rootPath, templateName);
            } catch (error) {
              if (error instanceof CancelOperationError) {
                telemetryContext.properties.result = 'Cancelled';
                telemetryContext.properties.errorMessage = error.message;
                return;
              } else {
                throw error;
              }
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
            const templateName = containerSelection.label;

            try {
              await this.configureProjectEnv(
                  context, scaffoldType, templateJson, rootPath, templateName);
            } catch (error) {
              if (error instanceof CancelOperationError) {
                telemetryContext.properties.result = 'Cancelled';
                telemetryContext.properties.errorMessage = error.message;
                return;
              } else {
                throw error;
              }
            }

            // If default case, ask user whether or not to customize container
            // Skip this step if caller already decide to open in remote
            // directly.
            if (!openInNewWindow) {
              let customizeEnvironment;
              try {
                customizeEnvironment = await this.askToCustomize();
              } catch (error) {
                if (error instanceof CancelOperationError) {
                  telemetryContext.properties.errorMessage = error.message;
                  telemetryContext.properties.result = 'Cancelled';
                  return;
                } else {
                  throw error;
                }
              }
              telemetryContext.properties.customizeEnvironment =
                  customizeEnvironment.toString();

              // If user do not want to customize develpment environment, open
              // the project in remote directly for user.
              if (!customizeEnvironment) {
                openInNewWindow = true;
              }
              // TODO: Open configuration file in current window for user to
              // edit configuration.
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
   * Configure project: Add configuration files
   * Ask to overwrite if file already exists.
   */
  private async configureProjectEnv(
      context: vscode.ExtensionContext, scaffoldType: ScaffoldType,
      templateJson: TemplatesType, rootPath: string, templateName: string) {
    const projectEnvTemplate =
        templateJson.templates.filter((template: ProjectTemplate) => {
          return (
              template.tag === TemplateTag.DevelopmentEnvironment &&
              template.name === templateName);
        });

    if (!(projectEnvTemplate && projectEnvTemplate.length > 0)) {
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
    await this.scaffoldConfigurationFiles(
        scaffoldType, rootPath, templateFilesInfo);
  }


  /**
   * Ask whether to customize the development environment or not
   * @returns true - want to customize; false - don't want to customize
   */
  private async askToCustomize(): Promise<boolean> {
    const customizationOption: vscode.QuickPickItem[] = [];
    customizationOption.push(
        {label: `Yes`, description: ''}, {label: `No`, description: ''});

    const customizationSelection =
        await vscode.window.showQuickPick(customizationOption, {
          ignoreFocusOut: true,
          placeHolder: `Do you want to customize the development environment?`
        });

    if (customizationSelection === undefined) {
      throw new CancelOperationError(
          `Ask to customization development environment selection cancelled.`);
    }

    return customizationSelection.label === 'Yes';
  }

  /**
   * Ask whether to overwrite tasks.json file or not
   */
  private async askToOverwriteFile(fileName: string):
      Promise<vscode.QuickPickItem> {
    const overwriteTasksJsonOption: vscode.QuickPickItem[] = [];
    overwriteTasksJsonOption.push(
        {
          label: OverwriteLabel.Yes,
          detail: 'Overwrite existed configuration file.'
        },
        {
          label: OverwriteLabel.No,
          detail:
              'Do not overwrite existed file and exit the configuration process.'
        },
        {
          label: OverwriteLabel.YesToAll,
          detail: 'Automatically overwrite all configuration files'
        });

    const overwriteSelection =
        await vscode.window.showQuickPick(overwriteTasksJsonOption, {
          ignoreFocusOut: true,
          placeHolder: `${fileName} already exists. Do you want to overwrite?`
        });

    if (overwriteSelection === undefined) {
      // Selection was cancelled
      throw new CancelOperationError(
          `Ask to overwrite ${fileName} selection cancelled.`);
    }

    return overwriteSelection;
  }

  /**
   * Scaffold configuration files for project. If file already exists, ask to
   * overwrite it.
   */
  private async scaffoldConfigurationFiles(
      scaffoldType: ScaffoldType, rootPath: string,
      templateFilesInfo: TemplateFileInfo[]) {
    let overWriteAll = false;
    for (const fileInfo of templateFilesInfo) {
      const targetPath = path.join(rootPath, fileInfo.targetPath);
      if (!await FileUtility.directoryExists(scaffoldType, targetPath)) {
        await FileUtility.mkdirRecursively(scaffoldType, targetPath);
      }

      const targetFilePath = path.join(targetPath, fileInfo.fileName);
      if (!overWriteAll) {
        // File exists.
        if (await FileUtility.fileExists(scaffoldType, targetFilePath)) {
          const fileOverwrite =
              await this.askToOverwriteFile(fileInfo.fileName);

          switch (fileOverwrite.label) {
            case OverwriteLabel.No:
              const message = `Not overwrite original ${
                  fileInfo.fileName}. Configuration operation cancelled.`;
              throw new CancelOperationError(message);
            case OverwriteLabel.YesToAll:
              overWriteAll = true;
              break;
            default:
              break;
          }
        }
      }

      // File not exists or choose to overwrite it.
      if (!fileInfo.fileContent) {
        throw new Error(`Fail to load ${fileInfo.fileName}.`);
      }

      try {
        await FileUtility.writeFile(
            scaffoldType, targetFilePath, fileInfo.fileContent);
      } catch (error) {
        throw new Error(`Write content to file ${targetFilePath} failed.`);
      }
    }
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