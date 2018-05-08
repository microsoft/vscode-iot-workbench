// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';

export interface CommandItem extends vscode.QuickPickItem {
  /**
   * Click action of the menu item
   */
  // tslint:disable-next-line: no-any
  click?: (...args: any[]) => any;
  /**
   * Submenu of the menu item
   */
  children?: CommandItem[];
  /**
   * Show the menu item when only the
   * workspace configuration contains
   * the specific field.
   */
  only?: string;
}