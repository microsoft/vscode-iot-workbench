import * as vscode from 'vscode';

export interface CommandItem extends vscode.QuickPickItem {
  // tslint:disable-next-line: no-any
  onClick?: (...args: any[]) => any;
  children?: CommandItem[];
}