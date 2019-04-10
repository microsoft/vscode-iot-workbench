// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';
import {ProjectTemplate} from './Models/Interfaces/ProjectTemplate';
import * as utils from './utils';
import {Board, BoardQuickPickItem} from './Models/Interfaces/Board';
import {Platform} from './Models/Interfaces/Platform';
import {TelemetryContext} from './telemetry';
import {FileNames} from './constants';
import {BoardProvider} from './boardProvider';
import {IoTWorkbenchSettings} from './IoTSettings';

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
            const platformSelection = await this.SelectPlatform(context);
            if (!platformSelection) {
              telemetryContext.properties.errorMessage =
                  'Platform selection canceled.';
              telemetryContext.properties.result = 'Canceled';
              return;
            } else {
              telemetryContext.properties.platform = platformSelection.label;
            }

            // Step 3: Select board
            const boardSelection = await this.SelectBoard(context);
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
            const templateSelection = await this.SelectTemplate(context, boardSelection);
            if (!templateSelection) {
              telemetryContext.properties.errorMessage =
                  'Project template selection canceled.';
              telemetryContext.properties.result = 'Canceled';
              return;
            } else {
              telemetryContext.properties.template = templateSelection.label;
            }

            // Step 5: Load project template
            const template = context.asAbsolutePath(path.join(
              FileNames.resourcesFolderName, boardSelection.id,
              FileNames.templateFileName));
            const templateJson = require(template);
            const result =
                templateJson.templates.find((template: ProjectTemplate) => {
                  return template.label === templateSelection.label;
                });

            if (!result) {
              throw new Error('Unable to load project template.');
            }

            if (result.type === 'AzureFunctions') {
              const isFunctionsExtensionAvailable =
                  await azureFunctionsModule.AzureFunctions.isAvailable();
              if (!isFunctionsExtensionAvailable) {
                return false;
              }
            }

            const project = new ioTProjectModule.IoTProject(
                context, channel, telemetryContext);
            let openInNewWindow = true;
            return await project.create(
              projectPath, result, boardSelection.id, openInNewWindow);
          } catch (error) {
            throw error;
          }
        });
  }

  private async SelectTemplate(context: vscode.ExtensionContext, boardSelection: BoardQuickPickItem) {    
    const template = context.asAbsolutePath(path.join(
      FileNames.resourcesFolderName, boardSelection.id,
      FileNames.templateFileName));
    const templateJson = require(template);

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

  private async SelectBoard(context: vscode.ExtensionContext) {
    const boardProvider = new BoardProvider(context);
    const boardItemList: BoardQuickPickItem[] = [];

    const boards = boardProvider.list;
    boards.forEach((board: Board) => {
      boardItemList.push({
        name: board.name,
        id: board.id,
        detailInfo: board.detailInfo,
        label: board.name,
        description: board.detailInfo,
      });
    });
    
    const boardSelection =
        await vscode.window.showQuickPick(boardItemList, {
          ignoreFocusOut: true,
          matchOnDescription: true,
          matchOnDetail: true,
          placeHolder: 'Select a board',
        });
    
    return boardSelection;
  }

  private async SelectPlatform(context: vscode.ExtensionContext) {
    const platformJson = require(context.asAbsolutePath(path.join(
      FileNames.resourcesFolderName, FileNames.platformListFileName)));

    const platformList: vscode.QuickPickItem[] = [];
    platformJson.platforms.forEach((element: Platform) => {
      platformList.push({
        label: element.label,
        description: element.description,
        detail: element.detail
      });
    });

    const platformSelection =
        await vscode.window.showQuickPick(platformList, {
          ignoreFocusOut: true,
          matchOnDescription: true,
          matchOnDetail: true,
          placeHolder: 'Select a platform',
        });

    return platformSelection;
  }

  private async GenerateProjectFolder() {    
    // Get default workbench path.  
    const settings: IoTWorkbenchSettings = new IoTWorkbenchSettings();
    const workbench = await settings.workbenchPath();

    const projectRootPath = path.join(workbench, 'projects');
    if (!utils.directoryExistsSync(projectRootPath)) {
      utils.mkdirRecursivelySync(projectRootPath);
    }

    let counter = 0;
    const name = constants.defaultProjectName;
    let candidateName = name;
    while (true) {
      const projectPath = path.join(projectRootPath, candidateName);
      if (!utils.fileExistsSync(projectPath) &&
          !utils.directoryExistsSync(projectPath)) {
        break;
      }
      counter++;
      candidateName = `${name}_${counter}`;
    }

    const projectName = await vscode.window.showInputBox({
      value: candidateName,
      prompt: 'Input project name.',
      ignoreFocusOut: true,
      validateInput: (projectName: string) => {
        if (!/^([a-z0-9_]|[a-z0-9_][-a-z0-9_.]*[a-z0-9_])(\.ino)?$/i.test(
                projectName)) {
          return 'Project name can only contain letters, numbers, "-" and ".", and cannot start or end with "-" or ".".';
        }
        const projectPath = path.join(projectRootPath, projectName);
        if (!utils.fileExistsSync(projectPath) &&
            !utils.directoryExistsSync(projectPath)) {
          return;
        } else {
          return `${projectPath} exists, please choose another name.`;
        }
      }
    });

    const projectPath =
        projectName ? path.join(projectRootPath, projectName) : undefined;
    if (projectPath) {
      utils.mkdirRecursivelySync(projectPath);
    }
    return projectPath;
  }
}
