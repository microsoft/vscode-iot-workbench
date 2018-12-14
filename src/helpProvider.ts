import * as vscode from 'vscode';

import {BoardProvider} from './boardProvider';
import {ConfigHandler} from './configHandler';
import {ConfigKey, ContentView} from './constants';
import {ContentProvider} from './contentProvider';

export class HelpProvider {
  static async open(context: vscode.ExtensionContext) {
    const boardId = ConfigHandler.get<string>(ConfigKey.boardId);

    if (boardId) {
      const boardProvider = new BoardProvider(context);
      const board = boardProvider.find({id: boardId});

      if (board && board.helpUrl) {
        await vscode.commands.executeCommand(
            'vscode.open', vscode.Uri.parse(board.helpUrl));
        return;
      }
    }

    const panel = vscode.window.createWebviewPanel(
        'IoTWorkbenchHelp', 'Welcome - Azure IoT Device Workbench',
        vscode.ViewColumn.One, {
          enableScripts: true,
          retainContextWhenHidden: true,
        });

    panel.webview.html =
        await ContentProvider.getInstance().provideTextDocumentContent(
            vscode.Uri.parse(ContentView.workbenchHelpURI));

    return;
  }
}