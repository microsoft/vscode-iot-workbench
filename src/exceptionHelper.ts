'use strict';

import * as vscode from 'vscode';

export function exceptionHelper(error: string, popupMsgbox: boolean): void;
export function exceptionHelper(error: Error, popupMsgbox: boolean): void;
export function exceptionHelper(
    error: string|Error, popupMsgbox: boolean): void {
  let _error: Error;
  let _message: string;

  if (typeof error === 'string') {
    _error = new Error(error);
    _message = error;
  } else {
    _error = error;
    _message = error.message;
  }

  if (popupMsgbox) {
    vscode.window.showErrorMessage(_message);
  }

  throw _error;
}