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
import {ConfigKey} from './constants';

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
    const boardId = ConfigHandler.get<string>(ConfigKey.boardId);
    const board = boardProvider.find({id: boardId});
    if (board === undefined) {
      throw new Error(`Board Id ${boardId} not found.`);
    }
    try {
      telemetryContext.properties.board = board.name;
      if (board) {
        await ArduinoPackageManager.installBoard(board);
      }
    } catch (error) {
      throw new Error(`Device package for ${board.name} installation failed: ${
          error.message}`);
    }
    vscode.window.showInformationMessage(
        `Device package for ${board.name} has been installed.`);
    return true;
  }
}
