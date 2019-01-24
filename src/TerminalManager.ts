// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from 'vscode';
import {GlobalConstants} from './constants';

export class TerminalManager {
  static onDidCloseTerminal(closedTerminal: vscode.Terminal): void {
    delete this.terminals[closedTerminal.name];
  }

  private static terminals: {[id: string]: vscode.Terminal} = {};

  private static createTerminal(terminal: string): vscode.Terminal {
    const options: vscode.TerminalOptions = {name: terminal};
    return vscode.window.createTerminal(options);
  }

  static runInTerminal(
      command: string,
      terminal: string = GlobalConstants.iotWorkbenchDisplayName): void {
    if (this.terminals[terminal] === undefined) {
      this.terminals[terminal] = TerminalManager.createTerminal(terminal);
    }
    this.terminals[terminal].show();
    this.terminals[terminal].sendText(command);
  }
}