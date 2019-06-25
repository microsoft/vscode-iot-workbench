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

const impor = require('impor')(__dirname);
const ioTProjectModule =
    impor('./Models/IoTProject') as typeof import('./Models/IoTProject');

export class DeviceOperator {
  async compile(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    const project =
        new ioTProjectModule.IoTProject(context, channel, telemetryContext);
    const result = await project.load();
    if (!result) {
      await project.handleLoadFailure();
      return;
    }
    await project.compile();
  }

  async upload(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    const project =
        new ioTProjectModule.IoTProject(context, channel, telemetryContext);
    const result = await project.load();
    if (!result) {
      await project.handleLoadFailure();
      return;
    }
    await project.upload();
  }

  async configDeviceSettings(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    const project =
        new ioTProjectModule.IoTProject(context, channel, telemetryContext);
    const result = await project.load();
    if (!result) {
      await project.handleLoadFailure();
      return;
    }
    await project.configDeviceSettings();
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
