import * as vscode from 'vscode';

export interface CommandItem extends vscode.QuickPickItem {
  /**
   * Click action of the menu item
   */
  // tslint:disable-next-line: no-any
  onClick?: (...args: any[]) => any;
  /**
   * Submenu of the menu item
   */
  children?: CommandItem[];
  /**
   * Show the meu item when only the
   * workspace configuration contains
   * the specific field.
   */
  only?: string;
}