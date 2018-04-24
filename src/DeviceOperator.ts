// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';
import {IoTProject} from './Models/IoTProject';
import {TelemetryContext} from './telemetry';
import {Board, BoardQuickPickItem} from './Models/Interfaces/Board';
import {ArduinoPackageManager} from './ArduinoPackageManager';

const constants = {
  boardListFileName: 'boardlist.json',
  resourceFolderName: 'resources',
};

export class DeviceOperator {
  async compile(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    if (!vscode.workspace.rootPath) {
      throw new Error(
          'Unable to find the root path, please open an IoT Workbench project.');
    }

    const project = new IoTProject(context, channel);
    const result = await project.load();
    if (!result) {
      throw new Error(
          'Unable to compile device code, please open an IoT Workbench project and retry.');
    }
    await project.compile();
  }

  async upload(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    if (!vscode.workspace.rootPath) {
      throw new Error(
          'Unable to find the root path, please open an IoT Workbench project.');
    }

    const project = new IoTProject(context, channel);
    const result = await project.load();
    if (!result) {
      throw new Error(
          'Unable to upload device code, please open an IoT Workbench project and retry.');
    }
    await project.upload();
  }

  async configDeviceSettings(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    if (!vscode.workspace.rootPath) {
      throw new Error(
          'Unable to find the root path, please open an IoT Workbench project.');
    }

    const project = new IoTProject(context, channel);
    const result = await project.load();
    if (!result) {
      throw new Error(
          'Unable to set device connection string, please open an IoT Workbench project and retry.');
    }
    await project.configDeviceSettings();
  }

  async downloadPackage(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    const boardItemList: BoardQuickPickItem[] = [];
    const boardList = context.asAbsolutePath(
        path.join(constants.resourceFolderName, constants.boardListFileName));
    const boardsJson = require(boardList);
    boardsJson.boards.forEach((board: Board) => {
      boardItemList.push({
        name: board.name,
        id: board.id,
        platform: board.platform,
        label: board.name,
        description: board.platform,
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
        await ArduinoPackageManager.installBoard(context, boardSelection.id);
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
