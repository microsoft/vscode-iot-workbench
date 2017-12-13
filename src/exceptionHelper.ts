'use strict';

import * as vscode from 'vscode';

export function exceptionHelper(error: Error, popupMsgbox: boolean) {
  if (popupMsgbox) {
    vscode.window.showErrorMessage(error.message);
  }

  console.error(error);
}