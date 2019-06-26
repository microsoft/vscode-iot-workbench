// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-plus';
import * as utils from './utils';

import {Board, BoardQuickPickItem} from './Models/Interfaces/Board';
import {TelemetryContext} from './telemetry';
import {ArduinoPackageManager} from './ArduinoPackageManager';
import {FileNames, ScaffoldType, PlatformType, platformFolderMap} from './constants';
import {BoardProvider} from './boardProvider';
import {IoTWorkbenchSettings} from './IoTSettings';
import {FileUtility} from './FileUtility';
import {ProjectTemplate, ProjectTemplateType, TemplateFileInfo} from './Models/Interfaces/ProjectTemplate';
import {IoTWorkbenchProjectBase} from './Models/IoTWorkbenchProjectBase';
import {Platform} from './Models/Interfaces/Platform';

const impor = require('impor')(__dirname);
const azureFunctionsModule = impor('./Models/AzureFunctions') as
    typeof import('./Models/AzureFunctions');
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
                  'Project name input canceled.';
              telemetryContext.properties.result = 'Canceled';
              return;
            } else {
              telemetryContext.properties.projectPath = projectPath;
            }

            // Step 2: Select platform
            const platformSelection = await this.SelectPlatform(context);
            if (!platformSelection) {
              telemetryContext.properties.errorMessage =
                  'Platform selection canceled.';
              telemetryContext.properties.result = 'Canceled';
              return;
            } else {
              telemetryContext.properties.platform = platformSelection.label;
            }

            if (platformSelection.label === 'no_device') {
              await utils.TakeNoDeviceSurvey(telemetryContext);
              return;
            }

            // Step 3: load board information
            const resourceRootPath = context.asAbsolutePath(path.join(
                FileNames.resourcesFolderName, FileNames.templatesFolderName));
            const boardProvider = new BoardProvider(resourceRootPath);
            const boards = boardProvider.list;

            // Step 4: Select template
            const template = await this.SelectTemplate(
                resourceRootPath, platformSelection.label);

            if (!template) {
              telemetryContext.properties.errorMessage =
                  'Project template selection canceled.';
              telemetryContext.properties.result = 'Canceled';
              return;
            } else {
              telemetryContext.properties.template = template.name;
            }

            // Step 5: Load the list of template files
            const projectTemplateType: ProjectTemplateType =
                (ProjectTemplateType)
                    [template.type as keyof typeof ProjectTemplateType];

            const templateFolder = context.asAbsolutePath(path.join(
                FileNames.resourcesFolderName, FileNames.templatesFolderName,
                template.path));

            const templateFiles =
                require(path.join(templateFolder, FileNames.templateFiles));

            const templateFilesInfo: TemplateFileInfo[] = [];
            templateFiles.templateFiles.forEach(
                (fileInfo: TemplateFileInfo) => {
                  const filePath = path.join(templateFolder, fileInfo.fileName);
                  const fileContent = fs.readFileSync(filePath, 'utf8');
                  templateFilesInfo.push({
                    fileName: fileInfo.fileName,
                    sourcePath: fileInfo.sourcePath,
                    targetPath: fileInfo.targetPath,
                    fileContent
                  });
                });


            if (projectPath) {
              await FileUtility.mkdirRecursively(
                  ScaffoldType.Local, projectPath);
            }

            const project =
                new ioTContainerizedProjectModule.IoTContainerizedProject(
                    context, channel, telemetryContext);
            // const project = new
            // ioTWorkspaceProjectModule.IoTWorkspaceProject(
            //   context, channel, telemetryContext);
            return await project.create(
                projectPath, templateFilesInfo, projectTemplateType,
                template.boardId, openInNewWindow);
          } catch (error) {
            throw error;
          }
        });
  }

  private async SelectTemplate(templateFolderPath: string, platform: string):
      Promise<ProjectTemplate|undefined> {
    const templateJson =
        require(path.join(templateFolderPath, FileNames.templateFileName));

    const result =
        templateJson.templates.filter((template: ProjectTemplate) => {
          return template.platform === platform;
        });

    const projectTemplateList: vscode.QuickPickItem[] = [];

    result.forEach((element: ProjectTemplate) => {
      projectTemplateList.push({
        label: element.name,
        description: element.description,
        detail: element.detail
      });
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
    }

    return templateJson.templates.find((template: ProjectTemplate) => {
      return template.platform === platform &&
          template.name === templateSelection.label;
    });
  }

  private async SelectBoard(boardFolderPath: string) {
    const boardProvider = new BoardProvider(boardFolderPath);
    const boardItemList: BoardQuickPickItem[] = [];

    const boards = boardProvider.list;
    boards.forEach((board: Board) => {
      boardItemList.push({
        name: board.name,
        model: board.model,
        id: board.id,
        detailInfo: board.detailInfo,
        label: board.name,
        description: board.detailInfo,
      });
    });

    const boardSelection = await vscode.window.showQuickPick(boardItemList, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: 'Select a board',
    });

    return boardSelection;
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

    const projectRootPath = path.join(workbench, 'projects');
    if (!await FileUtility.directoryExists(
            ScaffoldType.Local, projectRootPath)) {
      await FileUtility.mkdirRecursively(ScaffoldType.Local, projectRootPath);
    }

    let counter = 0;
    const name = constants.defaultProjectName;
    let candidateName = name;
    while (true) {
      const projectPath = path.join(projectRootPath, candidateName);
      const projectPathExists =
          await FileUtility.fileExists(ScaffoldType.Local, projectPath);
      const projectDirectoryExists =
          await FileUtility.directoryExists(ScaffoldType.Local, projectPath);
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
            await FileUtility.fileExists(ScaffoldType.Local, projectPath);
        const projectDirectoryExists =
            await FileUtility.directoryExists(ScaffoldType.Local, projectPath);
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
