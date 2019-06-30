// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';

import {TelemetryContext} from './telemetry';
import {Board, BoardQuickPickItem} from './Models/Interfaces/Board';
import {ArduinoPackageManager} from './ArduinoPackageManager';
import {BoardProvider} from './boardProvider';
import {FileNames} from './constants';
import {ProjectHostType} from './Models/Interfaces/ProjectHostType';
import {askAndNewProject} from './utils';

const impor = require('impor')(__dirname);
const ioTWorkspaceProjectModule = impor('./Models/IoTWorkspaceProject') as
    typeof import('./Models/IoTWorkspaceProject');
const ioTContainerizedProjectModule =
    impor('./Models/IoTContainerizedProject') as
    typeof import('./Models/IoTContainerizedProject');

export class DeviceOperator {
  private projectHostType: ProjectHostType;
  constructor(projectHostType: ProjectHostType) {
    this.projectHostType = projectHostType;
  }

  async compile(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    let iotProject;
    if (this.projectHostType === ProjectHostType.Container) {
      iotProject = new ioTContainerizedProjectModule.IoTContainerizedProject(
          context, channel, telemetryContext);
    } else if (this.projectHostType === ProjectHostType.Workspace) {
      iotProject = new ioTWorkspaceProjectModule.IoTWorkspaceProject(
          context, channel, telemetryContext);
    }
    if (iotProject === undefined) {
      await askAndNewProject(telemetryContext);
      return;
    }

    const result = await iotProject.load();
    if (!result) {
      await iotProject.handleLoadFailure();
      return;
    }
    await iotProject.compile();
  }

  async upload(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    let iotProject;
    if (this.projectHostType === ProjectHostType.Container) {
      iotProject = new ioTContainerizedProjectModule.IoTContainerizedProject(
          context, channel, telemetryContext);
    } else if (this.projectHostType === ProjectHostType.Workspace) {
      iotProject = new ioTWorkspaceProjectModule.IoTWorkspaceProject(
          context, channel, telemetryContext);
    }
    if (iotProject === undefined) {
      await askAndNewProject(telemetryContext);
      return;
    }

    const result = await iotProject.load();
    if (!result) {
      await iotProject.handleLoadFailure();
      return;
    }
    await iotProject.upload();
  }

  async configDeviceSettings(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    let iotProject;
    if (this.projectHostType === ProjectHostType.Container) {
      iotProject = new ioTContainerizedProjectModule.IoTContainerizedProject(
          context, channel, telemetryContext);
    } else if (this.projectHostType === ProjectHostType.Workspace) {
      iotProject = new ioTWorkspaceProjectModule.IoTWorkspaceProject(
          context, channel, telemetryContext);
    }
    if (iotProject === undefined) {
      await askAndNewProject(telemetryContext);
      return;
    }

    const result = await iotProject.load();
    if (!result) {
      await iotProject.handleLoadFailure();
      return;
    }
    await iotProject.configDeviceSettings();
  }

  async downloadPackage(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    const boardListFolderPath = context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName));
    const boardProvider = new BoardProvider(boardListFolderPath);
    const boardItemList: BoardQuickPickItem[] = [];
    const boards = boardProvider.list.filter(board => board.installation);
    boards.forEach((board: Board) => {
      boardItemList.push({
        name: board.name,
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

    if (!boardSelection) {
      telemetryContext.properties.errorMessage = 'Board selection canceled.';
      telemetryContext.properties.result = 'Canceled';
      return false;
    } else {
      telemetryContext.properties.board = boardSelection.label;
      try {
        const board = boardProvider.find({id: boardSelection.id});

        if (board) {
          await ArduinoPackageManager.installBoard(board);
        }
      } catch (error) {
        throw new Error(`Device package for ${
            boardSelection.label} installation failed: ${error.message}`);
      }
    }

    vscode.window.showInformationMessage(
        `Device package for ${boardSelection.label} has been installed.`);
    return true;
  }
}
