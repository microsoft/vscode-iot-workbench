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

enum OverwriteLabel {
  Yes = 'Yes',
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
          this.configureProjectEnvironmentCore(
              context, channel, telemetryContext, rootPath,
              PlatformType.Unknown, false);
        });

    return;
  }

  /**
   * Configuration operation adds configutation files for project.
   * For Embedded Linux project, ask user whether to customize environment. If
   * not, open Embedded Linux project in remote.
   * @param platform If platform is of Unknown type, command palatte will show
   * up for user to choose platform type.
   * @param openInNewWindow
   */
  async configureProjectEnvironmentCore(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext, projectPath: string,
      platform: PlatformType = PlatformType.Unknown, openInNewWindow = false) {
    if (!projectPath) {
      throw new Error(
          'Unable to find the project path, please open the folder and initialize project again.');
    }

    const scaffoldType = ScaffoldType.Local;

    // Step 1: Select platform if not specified
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
        platform =
            utils.getEnumKeyByEnumValue(PlatformType, platformSelection.label);
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

    // Step 2: Get environment template files
    let templateName: string;
    if (platform === PlatformType.Arduino) {
      templateName = 'Arduino Task';
    } else if (platform === PlatformType.EmbeddedLinux) {
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
    } else {
      throw new Error(`Unsupported Platform type!`);
    }
    telemetryContext.properties.templateName = templateName;

    const projectEnvTemplate =
        templateJson.templates.filter((template: ProjectTemplate) => {
          return (
              template.tag === TemplateTag.DevelopmentEnvironment &&
              template.name === templateName);
        });

    // Step 3: Configure project environment with template files
    try {
      await this.scaffoldConfigurationFiles(
          context, scaffoldType, projectPath, projectEnvTemplate);
    } catch (error) {
      if (error instanceof CancelOperationError) {
        telemetryContext.properties.result = 'Cancelled';
        telemetryContext.properties.errorMessage = error.message;
        return;
      } else {
        throw error;
      }
    }

    let message: string;
    // Open Embedded Linux project in remote if user don't customize container
    if (platform === PlatformType.EmbeddedLinux) {
      // If default case, ask user whether or not to customize container
      // Skip this step if caller already decide to open in remote
      // directly.
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

      if (!customizeEnvironment) {
        // If user does not want to customize develpment environment,
        //  we will open the project in remote directly for user.
        setTimeout(
            () => vscode.commands.executeCommand(
                'iotcube.openInContainer', projectPath),
            500);
      } else {
        // If user wants to customize development environment, open project
        // locally.
        setTimeout(
            () => vscode.commands.executeCommand(
                'iotcube.openLocally', projectPath, openInNewWindow),
            500);
      }

      message =
          'Configuration is done. You can edit configuration file to customize development environment And then run \'Azure IoT Device Workbench: Compile Device Code\' command to compile device code';
    } else if (platform === PlatformType.Arduino) {
      setTimeout(
          () => vscode.commands.executeCommand(
              'iotcube.openLocally', projectPath, openInNewWindow),
          500);
      message =
          'Configuration is done. You can run \'Azure IoT Device Workbench: Compile Device Code\' command to compile device code';
    } else {
      throw new Error(`Unsupported Platform type!`);
    }

    utils.channelShowAndAppendLine(channel, message);
    vscode.window.showInformationMessage(message);
  }

  /**
   * Configure project environment: Scaffold configuration files with the given
   * template files. Ask to overwrite if file already exists.
   */
  private async scaffoldConfigurationFiles(
      context: vscode.ExtensionContext, scaffoldType: ScaffoldType,
      projectPath: string, projectEnvTemplate: ProjectTemplate[]) {
    // Load template files
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

    // configure files
    let overwriteAll = false;
    for (const fileInfo of templateFilesInfo) {
      const targetPath = path.join(projectPath, fileInfo.targetPath);
      if (!await FileUtility.directoryExists(scaffoldType, targetPath)) {
        await FileUtility.mkdirRecursively(scaffoldType, targetPath);
      }

      const targetFilePath = path.join(targetPath, fileInfo.fileName);
      if (!overwriteAll) {
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
              overwriteAll = true;
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