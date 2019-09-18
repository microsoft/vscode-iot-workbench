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
import {IoTWorkbenchSettings} from './IoTSettings';
import {FileUtility} from './FileUtility';
import {ProjectTemplate, ProjectTemplateType} from './Models/Interfaces/ProjectTemplate';
import {Platform} from './Models/Interfaces/Platform';
import {RemoteExtension} from './Models/RemoteExtension';

const impor = require('impor')(__dirname);
const ioTWorkspaceProjectModule = impor('./Models/IoTWorkspaceProject') as
    typeof import('./Models/IoTWorkspaceProject');
const ioTContainerizedProjectModule =
    impor('./Models/IoTContainerizedProject') as
    typeof import('./Models/IoTContainerizedProject');

const constants = {
  defaultProjectName: 'IoTproject'
};

export class ProjectInitializer {
  async InitializeProject(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    if (RemoteExtension.isRemote(context)) {
      const message =
          `The project is open in a Docker container now. Open a new window and run this command again.`;
      vscode.window.showWarningMessage(message);
      return;
    }

    let openInNewWindow = false;
    // If current window contains other project, open the created project in new
    // window.
    if (vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length > 0) {
      openInNewWindow = true;
    }

    // Initial project
    await vscode.window.withProgress(
        {
          title: 'Project initialization',
          location: vscode.ProgressLocation.Window,
        },
        async (progress) => {
          progress.report({
            message: 'Updating a list of available template',
          });

          try {
            // Step 1: Get project name
            const projectPath = await this.GenerateProjectFolder();
            if (!projectPath) {
              telemetryContext.properties.errorMessage =
                  'Project name input cancelled.';
              telemetryContext.properties.result = 'Cancelled';
              return;
            } else {
              telemetryContext.properties.projectPath = projectPath;
            }

            // Step 2: Select platform
            const platformSelection = await this.SelectPlatform(context);
            if (!platformSelection) {
              telemetryContext.properties.errorMessage =
                  'Platform selection cancelled.';
              telemetryContext.properties.result = 'Cancelled';
              return;
            } else {
              telemetryContext.properties.platform = platformSelection.label;
            }

            // Step 4: Select template
            const resourceRootPath = context.asAbsolutePath(path.join(
                FileNames.resourcesFolderName, FileNames.templatesFolderName));
            const template = await this.SelectTemplate(
                telemetryContext, resourceRootPath, platformSelection.label);

            if (!template) {
              telemetryContext.properties.errorMessage =
                  'Project template selection cancelled.';
              telemetryContext.properties.result = 'Cancelled';
              return;
            } else {
              telemetryContext.properties.template = template.name;
            }

            // Step 5: Load the list of template files
            const projectTemplateType: ProjectTemplateType =
                (ProjectTemplateType)[template.type as keyof typeof ProjectTemplateType];

            const templateFolder = path.join(resourceRootPath, template.path);
            const templateFilesInfo =
                await utils.getTemplateFilesInfo(templateFolder);

            let project;
            if (template.platform === PlatformType.EMBEDDEDLINUX) {
              telemetryContext.properties.projectHostType = 'Container';
              project =
                  new ioTContainerizedProjectModule.IoTContainerizedProject(
                      context, channel, telemetryContext);
            } else if (template.platform === PlatformType.ARDUINO) {
              telemetryContext.properties.projectHostType = 'Workspace';
              project = new ioTWorkspaceProjectModule.IoTWorkspaceProject(
                  context, channel, telemetryContext);
            } else {
              throw new Error('unsupported platform');
            }
            return await project.create(
                projectPath, templateFilesInfo, projectTemplateType,
                template.boardId, openInNewWindow);
          } catch (error) {
            throw error;
          }
        });
  }

  private async SelectTemplate(
      telemetryContext: TelemetryContext, templateFolderPath: string,
      platform: string): Promise<ProjectTemplate|undefined> {
    const templateJson =
        require(path.join(templateFolderPath, FileNames.templateFileName));

    const result =
        templateJson.templates.filter((template: ProjectTemplate) => {
          return (
              template.platform === platform &&
              template.tag === TemplateTag.general);
        });

    const projectTemplateList: vscode.QuickPickItem[] = [];

    result.forEach((element: ProjectTemplate) => {
      projectTemplateList.push({
        label: element.name,
        description: element.description,
        detail: element.detail
      });
    });

    // add the selection of 'device not in the list'
    projectTemplateList.push({
      label: '$(issue-opened) My device is not in the list...',
      description: '',
      detail: ''
    });

    const templateSelection =
        await vscode.window.showQuickPick(projectTemplateList, {
          ignoreFocusOut: true,
          matchOnDescription: true,
          matchOnDetail: true,
          placeHolder: 'Select a project template'
        });

    if (!templateSelection) {
      return;
    } else if (
        templateSelection.label ===
        '$(issue-opened) My device is not in the list...') {
      await utils.TakeNoDeviceSurvey(telemetryContext);
      return;
    }

    return templateJson.templates.find((template: ProjectTemplate) => {
      return template.platform === platform &&
          template.name === templateSelection.label;
    });
  }

  private async SelectPlatform(context: vscode.ExtensionContext) {
    const platformListPath = context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName,
        FileNames.platformListFileName));

    const platformListJson = require(platformListPath);

    if (!platformListJson) {
      throw new Error('Unable to load platform list.');
    }

    const platformList: vscode.QuickPickItem[] = [];

    platformListJson.platforms.forEach((platform: Platform) => {
      platformList.push(
          {label: platform.name, description: platform.description});
    });

    const platformSelection = await vscode.window.showQuickPick(platformList, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: 'Select a platform',
    });

    return platformSelection;
  }

  private async GenerateProjectFolder() {
    // Get default workbench path.
    const settings: IoTWorkbenchSettings =
        await IoTWorkbenchSettings.createAsync();
    const workbench = await settings.workbenchPath();

    const scaffoldType = ScaffoldType.Local;
    const projectRootPath = path.join(workbench, 'projects');
    if (!await FileUtility.directoryExists(scaffoldType, projectRootPath)) {
      await FileUtility.mkdirRecursively(scaffoldType, projectRootPath);
    }

    let counter = 0;
    const name = constants.defaultProjectName;
    let candidateName = name;
    while (true) {
      const projectPath = path.join(projectRootPath, candidateName);
      const projectPathExists =
          await FileUtility.fileExists(scaffoldType, projectPath);
      const projectDirectoryExists =
          await FileUtility.directoryExists(scaffoldType, projectPath);
      if (!projectPathExists && !projectDirectoryExists) {
        break;
      }

      counter++;
      candidateName = `${name}_${counter}`;
    }

    const projectName = await vscode.window.showInputBox({
      value: candidateName,
      prompt: 'Input project name.',
      ignoreFocusOut: true,
      validateInput: async (projectName: string) => {
        if (!/^([a-z0-9_]|[a-z0-9_][-a-z0-9_.]*[a-z0-9_])(\.ino)?$/i.test(
                projectName)) {
          return 'Project name can only contain letters, numbers, "-" and ".", and cannot start or end with "-" or ".".';
        }

        const projectPath = path.join(projectRootPath, projectName);
        const projectPathExists =
            await FileUtility.fileExists(scaffoldType, projectPath);
        const projectDirectoryExists =
            await FileUtility.directoryExists(scaffoldType, projectPath);
        if (!projectPathExists && !projectDirectoryExists) {
          return;
        } else {
          return `${projectPath} exists, please choose another name.`;
        }
      }
    });

    const projectPath =
        projectName ? path.join(projectRootPath, projectName) : undefined;

    // We don't create the projectpath here in case user may cancel their
    // initialization in following steps Just generate a valid path for project
    return projectPath;
  }
}
