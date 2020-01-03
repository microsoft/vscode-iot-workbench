<<<<<<< bbbda130d6515e3d7f48de5c9ac57cc09ea22585
import * as vscode from "vscode";
import { DependentExtensions } from "../constants";
import { DialogResponses } from "../DialogResponses";
import { WorkbenchExtension } from "../WorkbenchExtension";
import { VscodeCommands } from "../common/Commands";
import { CancelOperationError } from "../common/CancelOperationError";
=======

'use strict';

import * as vscode from 'vscode';
import {DependentExtensions} from '../constants';
import {DialogResponses} from '../DialogResponses';
import {WorkbenchExtension} from '../WorkbenchExtension';
import {VscodeCommands} from '../common/Commands';
import {OperationCanceledError, RemoteEnvNotSupportedError, OperationFailedError} from '../common/Error/Error';
>>>>>>> Define specific error type

export class RemoteExtension {
  static isRemote(context: vscode.ExtensionContext): boolean {
    const extension = WorkbenchExtension.getExtension(context);
    if (!extension) {
<<<<<<< bbbda130d6515e3d7f48de5c9ac57cc09ea22585
      throw new Error("Fail to get workbench extension.");
=======
      throw new OperationFailedError('get workbench extension ');
>>>>>>> Define specific error type
    }
    return extension.extensionKind === vscode.ExtensionKind.Workspace;
  }

  /**
   * Check whether remote extension is installed in VS Code.
   * If not, ask user to install it from marketplace.
   * @returns true - remote extension is installed.
   * @returns false - remote extension is not installed.
   */
  static async isAvailable(): Promise<boolean> {
    if (!vscode.extensions.getExtension(DependentExtensions.remote)) {
      const message =
        "Remote extension is required for the current project. Do you want to install it from marketplace?";
      const choice = await vscode.window.showInformationMessage(message, DialogResponses.yes, DialogResponses.no);
      if (choice === DialogResponses.yes) {
        vscode.commands.executeCommand(
          VscodeCommands.VscodeOpen,
          vscode.Uri.parse("vscode:extension/" + DependentExtensions.remote)
        );
      }
      return false;
    }
    return true;
  }

  static async checkRemoteExtension(): Promise<void> {
    const res = await RemoteExtension.isAvailable();
    if (!res) {
<<<<<<< bbbda130d6515e3d7f48de5c9ac57cc09ea22585
      throw new CancelOperationError(
        `Remote extension is not available. Please install ${DependentExtensions.remote} first.`
      );
=======
      throw new OperationCanceledError(
          `Remote extension is not available. Please install ${
              DependentExtensions.remote} first.`);
>>>>>>> Define specific error type
    }
  }

  /**
   * Ensure we are not in remote environment before running a command.
   * If in remote environment, throw error.
   */
  static ensureLocalBeforeRunCommand(context: vscode.ExtensionContext): void {
    if (RemoteExtension.isRemote(context)) {
      const message = 'Open a new window and run this command again.';
      throw new RemoteEnvNotSupportedError(message);
    }
  }
}
