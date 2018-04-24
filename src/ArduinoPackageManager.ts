// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {FileNames} from './constants';
import {Board} from './Models/Interfaces/Board';

export class ArduinoPackageManager {
  private static async setAdditionalUrl(url: string) {
    const existedUrls =
        vscode.workspace.getConfiguration().get<string[]|string>(
            'arduino.additionalUrls');
    if (!existedUrls || existedUrls.length === 0) {
      await vscode.workspace.getConfiguration().update(
          'arduino.additionalUrls', url, vscode.ConfigurationTarget.Global);
    } else {
      let _existedUrls: string[];
      if (typeof existedUrls === 'string') {
        _existedUrls = existedUrls.split(',').map((url) => url.trim());
      } else {
        _existedUrls = existedUrls;
      }
      for (const additionalUrl of _existedUrls) {
        if (additionalUrl === url) {
          return;
        }
      }
      _existedUrls.push(url);
      if (typeof existedUrls === 'string') {
        await vscode.workspace.getConfiguration().update(
            'arduino.additionalUrls', _existedUrls.join(','),
            vscode.ConfigurationTarget.Global);
      } else {
        await vscode.workspace.getConfiguration().update(
            'arduino.additionalUrls', _existedUrls,
            vscode.ConfigurationTarget.Global);
      }
    }
  }

  static async installBoard(context: vscode.ExtensionContext, boardId: string) {
    const boardList = context.asAbsolutePath(
        path.join(FileNames.resourcesFolderName, FileNames.boardListFileName));
    const boardsJson = require(boardList);

    const board = boardsJson.boards.find((template: Board) => {
      return template.id === boardId;
    });

    if (!board || !board.installation) {
      return;
    }

    await ArduinoPackageManager.setAdditionalUrl(
        board.installation.additionalUrl);
    await vscode.commands.executeCommand(
        'arduino.installBoard', board.installation.packageName,
        board.installation.architecture);
    return;
  }
}