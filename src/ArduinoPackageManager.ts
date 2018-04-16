// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';

export interface BoardInfo {
  additionalUrl: string;
  packageName: string;
  architecture: string;
}
const BOARD_INFO: {[key: string]: BoardInfo} = {
  devkit: {
    additionalUrl:
        'https://raw.githubusercontent.com/VSChina/azureiotdevkit_tools/master/package_azureboard_index.json',
    packageName: 'AZ3166',
    architecture: 'stm32f4'
  }
};

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

  static async installBoard(boardId: string) {
    const board = BOARD_INFO[boardId];
    if (!board) {
      return;
    }

    await ArduinoPackageManager.setAdditionalUrl(board.additionalUrl);
    await vscode.commands.executeCommand('arduino.loadPackages');
    await vscode.commands.executeCommand(
        'arduino.installBoard', board.packageName, board.architecture);
    return;
  }
}