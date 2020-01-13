// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

"use strict";

import * as vscode from "vscode";
import * as utils from "./utils";

export class ExceptionHelper {
  static logError(channel: vscode.OutputChannel | undefined, error: Error, popupErrorMsg: string): void;
  static logError(channel: vscode.OutputChannel | undefined, errorMsg: string, popupErrorMsg: string): void;
  static logError(channel: vscode.OutputChannel | undefined, error: Error, isPopupErrorMsg: boolean): void;
  static logError(channel: vscode.OutputChannel | undefined, errorMsg: string, isPopupErrorMsg: boolean): void;
  static logError(
    channel: vscode.OutputChannel | undefined,
    errorValue: string | Error,
    popupValue: string | boolean
  ): void {
    let _error: Error;
    let _message: string;

    if (typeof errorValue === "string") {
      _error = new Error(errorValue);
      _message = errorValue;
    } else {
      _error = errorValue;
      _message = errorValue.message;
    }

    if (popupValue === true) {
      vscode.window.showErrorMessage(_message);
    } else if (typeof popupValue === "string") {
      vscode.window.showErrorMessage(popupValue);
    }

    if (channel) {
      let errorMessage: string;
      if (_error.message) {
        errorMessage = _error.message;
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      } else if ((_error as any).body && (_error as any).body.message) {
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        errorMessage = (_error as any).body.message;
      } else {
        errorMessage = _error.toString();
      }

      utils.channelShowAndAppendLine(channel, errorMessage);
    }
  }
}
