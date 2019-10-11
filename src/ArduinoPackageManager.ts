// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';

import {Board, BoardInstallation} from './Models/Interfaces/Board';

export class ArduinoPackageManager {
  private static INSTALLED_BOARDS: Board[] = [];
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

  static async installBoard(board: Board) {
    if (!board || !board.installation) {
      return;
    }

    const cachedBoard = ArduinoPackageManager.INSTALLED_BOARDS.find(_board => {
      const _installation = _board.installation as BoardInstallation;
      const installation = board.installation as BoardInstallation;
      return _installation.packageName === installation.packageName &&
          _installation.architecture === installation.architecture;
    });

    if (cachedBoard) {
      return;
    }

    try {
      await ArduinoPackageManager.setAdditionalUrl(
          board.installation.additionalUrl);
      await vscode.commands.executeCommand(
          'arduino.installBoard', board.installation.packageName,
          board.installation.architecture);
      ArduinoPackageManager.INSTALLED_BOARDS.push(board);
    } catch (ignore) {
      // If we failed to install board package,
      // it may because the user hasn't installed
      // Arduino extension. Let's just ignore
      // that. We should have asked the user
      // to install Arduino extension somewhere
      // else already
    }
    return;
  }
}