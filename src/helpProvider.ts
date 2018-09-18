import * as vscode from 'vscode';

import {BoardProvider} from './boardProvider';
import {ConfigHandler} from './configHandler';
import {ConfigKey, ContentView} from './constants';

export class HelpProvider {
  static async open(context: vscode.ExtensionContext) {
    let boardId = ConfigHandler.get<string|string[]>(ConfigKey.boardId);

    if (typeof boardId === 'string') {
      boardId = [boardId];
    }

    if (!boardId) {
      return;
    }
    boardId = boardId[0];


    if (boardId) {
      const boardProvider = new BoardProvider(context);
      const board = boardProvider.find({id: boardId});

      if (board && board.helpUrl) {
        await vscode.commands.executeCommand(
            'vscode.open', vscode.Uri.parse(board.helpUrl));
        return;
      }
    }

    await vscode.commands.executeCommand(
        'vscode.previewHtml', ContentView.workbenchHelpURI,
        vscode.ViewColumn.One, 'Welcome - Azure IoT Workbench');
    return;
  }
}