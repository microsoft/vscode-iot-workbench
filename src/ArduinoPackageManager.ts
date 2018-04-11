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
        vscode.workspace.getConfiguration('arduino').get<string[]>(
            'additionalUrls');
    if (!existedUrls || existedUrls.length === 0) {
      await vscode.workspace.getConfiguration('arduino').update(
          'additionalUrls', [url]);
    } else {
      for (const additionalUrl of existedUrls) {
        if (additionalUrl === url) {
          return;
        }
      }
      existedUrls.push(url);
      await vscode.workspace.getConfiguration('arduino').update(
          'additionalUrls', existedUrls, vscode.ConfigurationTarget.Global);
    }
  }

  static async installBoard(boardId: string) {
    const board = BOARD_INFO[boardId];
    if (!board) {
      return;
    }

    await ArduinoPackageManager.setAdditionalUrl(board.additionalUrl);
    await vscode.commands.executeCommand(
        'arduino.installBoard', board.packageName, board.architecture);
    return;
  }
}