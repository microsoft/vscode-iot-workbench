// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';
import {ProjectTemplate, ProjectTemplateType, TemplateFileInfo} from './Models/Interfaces/ProjectTemplate';
import * as utils from './utils';
import {Board, BoardQuickPickItem} from './Models/Interfaces/Board';
import {TelemetryContext} from './telemetry';
import {FileNames, PlatformType, ScaffoldType} from './constants';
import {BoardProvider} from './boardProvider';
import {IoTWorkbenchSettings} from './IoTSettings';
import {FileUtility} from './FileUtility';
import { ScaffoldGenerator } from './Models/ScaffoldGenerator';

const impor = require('impor')(__dirname);
const azureFunctionsModule = impor('./Models/AzureFunctions') as
    typeof import('./Models/AzureFunctions');
const ioTProjectModule =
    impor('./Models/IoTProject') as typeof import('./Models/IoTProject');

const constants = {
  defaultProjectName: 'IoTproject'
};

export class ProjectInitializer {
  async InitializeProject(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
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
            const platformSelection = await this.SelectPlatform();
            if (!platformSelection) {
              telemetryContext.properties.errorMessage =
                  'Platform selection canceled.';
              telemetryContext.properties.result = 'Canceled';
              return;
            } else {
              telemetryContext.properties.platform = platformSelection.label;
            }

            // Step 3: Select board
            const boardFolderPath = context.asAbsolutePath(path.join(
                FileNames.resourcesFolderName, platformSelection.label));
            const boardSelection = await this.SelectBoard(boardFolderPath);
            if (!boardSelection) {
              telemetryContext.properties.errorMessage =
                  'Board selection canceled.';
              telemetryContext.properties.result = 'Canceled';
              return;
            } else if (boardSelection.id === 'no_device') {
              await utils.TakeNoDeviceSurvey(telemetryContext);
              return;
            } else {
              telemetryContext.properties.board = boardSelection.label;
            }

            // Step 4: Template select
            const templateFolderPath =
                path.join(boardFolderPath, boardSelection.id);
            const templateSelection =
                await this.SelectTemplate(templateFolderPath);
            if (!templateSelection) {
              telemetryContext.properties.errorMessage =
                  'Project template selection canceled.';
              telemetryContext.properties.result = 'Canceled';
              return;
            } else {
              telemetryContext.properties.template = templateSelection.label;
            }

            // Step 5: Load project template
            const templateJson = require(
                path.join(templateFolderPath, FileNames.templateFileName));
            const result =
                templateJson.templates.find((template: ProjectTemplate) => {
                  return template.label === templateSelection.label;
                });

            if (!result) {
              throw new Error('Unable to load project template.');
            }

            const projectTemplateType: ProjectTemplateType = (ProjectTemplateType)[result.type as keyof typeof ProjectTemplateType];

            if (projectTemplateType === ProjectTemplateType.AzureFunctions) {
              const isFunctionsExtensionAvailable =
                  await azureFunctionsModule.AzureFunctions.isAvailable();
              if (!isFunctionsExtensionAvailable) {
                return false;
              }
            }

            // Update telemetry
            const templateFilesInfo: TemplateFileInfo[] = [];
            result.templateFilesInfo.forEach((fileInfo: TemplateFileInfo) => {
              const filePath = path.join(templateFolderPath, fileInfo.fileName);
              const fileContent = fs.readFileSync(filePath, 'utf8');
              templateFilesInfo.push({
                fileName: fileInfo.fileName,
                sourcePath: fileInfo.sourcePath,
                targetPath: fileInfo.targetPath,
                fileContent
              });
            });


            if (projectPath) {
              await FileUtility.mkdirRecursively(ScaffoldType.local, projectPath);
            }
            const project = new ioTProjectModule.IoTProject(
                context, channel, telemetryContext);
            return await project.create(
                projectPath, templateFilesInfo, projectTemplateType,
                boardSelection.id, true);
          } catch (error) {
            throw error;
          }
        });
  }

  private async SelectTemplate(templateFolderPath: string) {
    const templateJson =
        require(path.join(templateFolderPath, FileNames.templateFileName));

    const projectTemplateList: vscode.QuickPickItem[] = [];

    templateJson.templates.forEach((element: ProjectTemplate) => {
      projectTemplateList.push({
        label: element.label,
        description: element.description,
        detail: element.detail
      });
    });

    const templateSelection =
        await vscode.window.showQuickPick(projectTemplateList, {
          ignoreFocusOut: true,
          matchOnDescription: true,
          matchOnDetail: true,
          placeHolder: 'Select a project template',
        });

    return templateSelection;
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

  private async SelectPlatform() {
    const platformList: vscode.QuickPickItem[] = [
      {
        'label': PlatformType.ARDUINO,
        'description': 'Project based on Arduino Platform.'
      },
      {
        'label': PlatformType.LINUX,
        'description':
            'Project based on Linux(Yocto/Ubuntu/Debian/...) Platform.'
      }
    ];

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
    const settings: IoTWorkbenchSettings = await IoTWorkbenchSettings.createAsync();
    const workbench = await settings.workbenchPath();

    const projectRootPath = path.join(workbench, 'projects');
    if (!await FileUtility.exists(ScaffoldType.local, projectRootPath)) {
      await FileUtility.mkdirRecursively(ScaffoldType.local, projectRootPath);
    }

    let counter = 0;
    const name = constants.defaultProjectName;
    let candidateName = name;
    while (true) {
      const projectPath = path.join(projectRootPath, candidateName);
      const projectPathExists = await FileUtility.fileExists(ScaffoldType.local, projectPath);
      const projectDirectoryExists = await FileUtility.directoryExists(ScaffoldType.local, projectPath);
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
        const projectPathExists = await FileUtility.fileExists(ScaffoldType.local, projectPath);
        const projectDirectoryExists = await FileUtility.directoryExists(ScaffoldType.local, projectPath);
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
