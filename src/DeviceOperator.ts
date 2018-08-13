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
import {BoardProvider} from './boardProvider';
import {ConfigHandler} from './configHandler';
import {ConfigKey, FileNames} from './constants';
import {OTA} from './Models/OTA';

export class DeviceOperator {
  async compile(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    if (!vscode.workspace.rootPath) {
      throw new Error(
          'Unable to find the root path, please open an IoT Workbench project.');
    }

    const project = new IoTProject(context, channel, telemetryContext);
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

    const project = new IoTProject(context, channel, telemetryContext);
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

    const project = new IoTProject(context, channel, telemetryContext);
    const result = await project.load();
    if (!result) {
      throw new Error(
          'Unable to config device settings, please open an IoT Workbench project and retry.');
    }
    await project.configDeviceSettings();
  }

  async downloadPackage(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    const boardProvider = new BoardProvider(context);
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

  async generateCrc(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    if (!vscode.workspace.workspaceFolders) {
      channel.appendLine('No workspace opened.');
      return false;
    }

    const devicePath = ConfigHandler.get<string>(ConfigKey.devicePath);
    if (!devicePath) {
      channel.appendLine('No device path found in workspace configuration.');
      return false;
    }
    const deviceBuildLocation = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath, '..', devicePath,
        '.build');

    if (!deviceBuildLocation) {
      channel.appendLine('No device compile output folder found.');
      return false;
    }

    const binFiles = fs.listSync(deviceBuildLocation, ['bin']);
    if (!binFiles || !binFiles.length) {
      channel.appendLine('No bin file found.');
      return false;
    }

    let binFilePath = '';

    if (binFiles.length === 1) {
      binFilePath = binFiles[0];
    } else {
      const binFilePickItems: vscode.QuickPickItem[] = [];
      for (const file of binFiles) {
        const fileName = path.basename(file);
        binFilePickItems.push({label: fileName, description: file});
        const choice = await vscode.window.showQuickPick(binFilePickItems, {
          ignoreFocusOut: true,
          matchOnDescription: true,
          matchOnDetail: true,
          placeHolder: 'Select bin file',
        });

        if (!choice) {
          return false;
        }

        binFilePath = choice.description;
      }
    }

    if (!binFilePath || !fs.existsSync(binFilePath)) {
      return false;
    }

    const res = OTA.generateCrc(binFilePath);
    channel.appendLine('========== CRC Information ==========');
    channel.appendLine('');
    channel.appendLine('fwPackageCheckValue: ' + res.crc);
    channel.appendLine('fwSize: ' + res.size);
    channel.appendLine('');
    channel.appendLine('======================================');

    return true;
  }
}
