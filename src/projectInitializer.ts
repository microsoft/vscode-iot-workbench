// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';
import {IoTProject} from './Models/IoTProject';
import {ProjectTemplate, ProjectTemplateType} from './Models/Interfaces/ProjectTemplate';
import {DialogResponses} from './DialogResponses';
import {IoTWorkbenchSettings} from './IoTSettings';
import * as utils from './utils';
import {Board, BoardInstallation, BoardQuickPickItem} from './Models/Interfaces/Board';
import {TelemetryContext} from './telemetry';
import {ArduinoPackageManager} from './ArduinoPackageManager';
import {FileNames} from './constants';
import {BoardProvider} from './boardProvider';

const constants = {
  defaultProjectName: 'IoTproject'
};

export class ProjectInitializer {
  async InitializeProject(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    let rootPath: string;
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
            // Select board
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

            // add the selection of 'device not in the list'
            boardItemList.push({
              name: '',
              id: 'no_device',
              detailInfo: '',
              label: '$(issue-opened) My device is not in the list...',
              description: '',
            });

            const boardSelection =
                await vscode.window.showQuickPick(boardItemList, {
                  ignoreFocusOut: true,
                  matchOnDescription: true,
                  matchOnDetail: true,
                  placeHolder: 'Select a board',
                });

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
              const board = boardProvider.find({id: boardSelection.id});

              if (board) {
                await ArduinoPackageManager.installBoard(board);
              }
            }

            // Template select
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

            const selection =
                await vscode.window.showQuickPick(projectTemplateList, {
                  ignoreFocusOut: true,
                  matchOnDescription: true,
                  matchOnDetail: true,
                  placeHolder: 'Select a project template',
                });

            if (!selection) {
              telemetryContext.properties.errorMessage =
                  'Project template selection canceled.';
              telemetryContext.properties.result = 'Canceled';
              return;
            } else {
              telemetryContext.properties.template = selection.label;
            }

            const result =
                templateJson.templates.find((template: ProjectTemplate) => {
                  return template.label === selection.label;
                });

            if (!result) {
              throw new Error('Unable to load project template.');
            }

            try {
              rootPath = await utils.selectWorkspaceItem(
                  'Please select a folder to contain your IoT Project:', {
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    defaultUri: vscode.workspace.workspaceFolders &&
                            vscode.workspace.workspaceFolders.length > 0 ?
                        vscode.workspace.workspaceFolders[0].uri :
                        undefined,
                    openLabel: 'Select'
                  });

              if (!rootPath) {
                throw new Error('User cancelled folder selection.');
              }

              const projectFolder = await this.GenerateProjectFolder(rootPath);
              if (!projectFolder) {
                throw new Error('Generate Project Folder canceled');
              }
              rootPath = projectFolder;
            } catch (error) {
              telemetryContext.properties.errorMessage =
                  `Folder selection canceled. ${error}`;
              telemetryContext.properties.result = 'Canceled';
              return;
            }

            const project = new IoTProject(context, channel, telemetryContext);
            return await project.create(
                rootPath, result, boardSelection.id, openInNewWindow);
          } catch (error) {
            throw error;
          }
        });
  }


  private async GenerateProjectFolder(rootPath: string) {
    let counter = 0;
    const name = constants.defaultProjectName;
    let candidateName = name;
    while (true) {
      const projectPath = path.join(rootPath, candidateName);
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
        const projectPath = path.join(rootPath, projectName);
        if (!utils.fileExistsSync(projectPath) &&
            !utils.directoryExistsSync(projectPath)) {
          return;
        } else {
          return `${projectPath} exists, please choose another name.`;
        }
      }
    });

    const projectPath =
        projectName ? path.join(rootPath, projectName) : undefined;
    if (projectPath) {
      utils.mkdirRecursivelySync(projectPath);
    }
    return projectPath;
  }
}
