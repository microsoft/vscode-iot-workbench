'use strict';

import * as vscode from 'vscode';

export class ExceptionHelper {
  static logError(error: string|Error, popupMsg: string|boolean): void {
    let _error: Error;
    let _message: string;

    if (typeof error === 'string') {
      _error = new Error(error);
      _message = error;
    } else {
      _error = error;
      _message = error.message;
    }

    if (popupMsg === true) {
      vscode.window.showErrorMessage(_message);
    } else if (typeof popupMsg === 'string') {
      vscode.window.showErrorMessage(popupMsg);
    }

    throw _error;
  }
}
