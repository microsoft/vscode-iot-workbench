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
import {FileNames, PlatformType, platformFolderMap} from './constants';
import {ProjectHostType} from './Models/Interfaces/ProjectHostType';

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
    if (this.projectHostType === ProjectHostType.Container) {
      const iotContainerProject =
          new ioTContainerizedProjectModule.IoTContainerizedProject(
              context, channel, telemetryContext);
      const result = await iotContainerProject.load();
      if (!result) {
        await iotContainerProject.handleLoadFailure();
        return;
      }
      await iotContainerProject.compile();
    } else if (this.projectHostType === ProjectHostType.Workspace) {
      const iotWorkspaceProject =
          new ioTWorkspaceProjectModule.IoTWorkspaceProject(
              context, channel, telemetryContext);
      const result = await iotWorkspaceProject.load();
      if (!result) {
        await iotWorkspaceProject.handleLoadFailure();
        return;
      }
      await iotWorkspaceProject.compile();
    }
  }

  async upload(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    if (this.projectHostType === ProjectHostType.Container) {
      const iotContainerProject =
          new ioTContainerizedProjectModule.IoTContainerizedProject(
              context, channel, telemetryContext);
      const result = await iotContainerProject.load();
      if (!result) {
        await iotContainerProject.handleLoadFailure();
        return;
      }
      await iotContainerProject.upload();
    } else if (this.projectHostType === ProjectHostType.Workspace) {
      const iotWorkspaceProject =
          new ioTWorkspaceProjectModule.IoTWorkspaceProject(
              context, channel, telemetryContext);
      const result = await iotWorkspaceProject.load();
      if (!result) {
        await iotWorkspaceProject.handleLoadFailure();
        return;
      }
      await iotWorkspaceProject.upload();
    }
  }

  async configDeviceSettings(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    if (this.projectHostType === ProjectHostType.Container) {
      const iotContainerProject =
          new ioTContainerizedProjectModule.IoTContainerizedProject(
              context, channel, telemetryContext);
      const result = await iotContainerProject.load();
      if (!result) {
        await iotContainerProject.handleLoadFailure();
        return;
      }
      await iotContainerProject.configDeviceSettings();
    } else if (this.projectHostType === ProjectHostType.Workspace) {
      const iotWorkspaceProject =
          new ioTWorkspaceProjectModule.IoTWorkspaceProject(
              context, channel, telemetryContext);
      const result = await iotWorkspaceProject.load();
      if (!result) {
        await iotWorkspaceProject.handleLoadFailure();
        return;
      }
      await iotWorkspaceProject.configDeviceSettings();
    }
  }

  async downloadPackage(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    const platformFolder = platformFolderMap.get(PlatformType.EMBEDDEDLINUX);
    if (platformFolder === undefined) {
      throw new Error(`Platform ${
          PlatformType.EMBEDDEDLINUX}'s  resource folder does not exist.`);
    }
    const boardFolderPath = context.asAbsolutePath(
        path.join(FileNames.resourcesFolderName, platformFolder));
    const boardProvider = new BoardProvider(boardFolderPath);
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
