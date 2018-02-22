'use strict';

import * as vscode from 'vscode';

export class ExceptionHelper {
  static logError(
      channel: vscode.OutputChannel|undefined, error: Error,
      popupErrorMsg: string): void;
  static logError(
      channel: vscode.OutputChannel|undefined, errorMsg: string,
      popupErrorMsg: string): void;
  static logError(
      channel: vscode.OutputChannel|undefined, error: Error,
      isPopupErrorMsg: boolean): void;
  static logError(
      channel: vscode.OutputChannel|undefined, errorMsg: string,
      isPopupErrorMsg: boolean): void;
  static logError(
      channel: vscode.OutputChannel|undefined, errorValue: string|Error,
      popupValue: string|boolean): void {
    let _error: Error;
    let _message: string;

    if (typeof errorValue === 'string') {
      _error = new Error(errorValue);
      _message = errorValue;
    } else {
      _error = errorValue;
      _message = errorValue.message;
    }

    if (popupValue === true) {
      vscode.window.showErrorMessage(_message);
    } else if (typeof popupValue === 'string') {
      vscode.window.showErrorMessage(popupValue);
    }

    if (channel) {
      let errorMessage: string;
      if (_error.message) {
        errorMessage = _error.message;
        // tslint:disable-next-line: no-any
      } else if ((_error as any).body && (_error as any).body.message) {
        // tslint:disable-next-line: no-any
        errorMessage = (_error as any).body.message;
      } else {
        errorMessage = _error.toString();
      }
      channel.append(errorMessage);
    }

    throw _error;
  }
}
