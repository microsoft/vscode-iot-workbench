
'use strict';

import * as vscode from 'vscode';
import {DependentExtensions} from '../constants';
import {DialogResponses} from '../DialogResponses';
import {channelShowAndAppendLine} from '../utils';
import {WorkbenchExtension} from '../WorkbenchExtension';
import {WorkbenchCommands, VscodeCommands} from '../common/Commands';
import {CancelOperationError} from '../CancelOperationError';

export class RemoteExtension {
  static isRemote(context: vscode.ExtensionContext) {
    const extension = WorkbenchExtension.getExtension(context);
    if (!extension) {
      throw new Error('Fail to get workbench extension.');
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
          'Remote extension is required for the current project. Do you want to install it from marketplace?';
      const choice = await vscode.window.showInformationMessage(
          message, DialogResponses.yes, DialogResponses.no);
      if (choice === DialogResponses.yes) {
        vscode.commands.executeCommand(
            VscodeCommands.VscodeOpen,
            vscode.Uri.parse('vscode:extension/' + DependentExtensions.remote));
      }
      return false;
    }
    return true;
  }

  static async checkRemoteExtension(): Promise<void> {
    const res = await RemoteExtension.isAvailable();
    if (!res) {
      throw new CancelOperationError(
          `Remote extension is not available. Please install ${
              DependentExtensions.remote} first.`);
    }
  }

  /**
   * Check we are not in remote context before running a command
   * @return true - in local environment; false - in remote environment
   */
  static checkLocalBeforeRunCommand(context: vscode.ExtensionContext): boolean {
    if (RemoteExtension.isRemote(context)) {
      const message =
          `The command is not supported to be run in a remote environment. Open a new window and run this command again.`;
      vscode.window.showWarningMessage(message);
      return false;
    }
    return true;
  }
}