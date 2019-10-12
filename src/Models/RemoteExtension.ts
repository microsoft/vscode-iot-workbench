
'use strict';

import * as vscode from 'vscode';
import {DependentExtensions, GlobalConstants} from '../constants';
import {DialogResponses} from '../DialogResponses';
import {channelShowAndAppendLine} from '../utils';

export class RemoteExtension {
  static isRemote(context: vscode.ExtensionContext) {
    // tslint:disable-next-line: no-any
    return (vscode as any)
               .extensions.getExtension(GlobalConstants.extensionId)
               .extensionKind === vscode.ExtensionKind.Workspace;
  }

  static async isAvailable(): Promise<boolean> {
    if (!vscode.extensions.getExtension(DependentExtensions.remote)) {
      const message =
          'Remote extension is required for the current project. Do you want to install it from marketplace?';
      const choice = await vscode.window.showInformationMessage(
          message, DialogResponses.yes, DialogResponses.no);
      if (choice === DialogResponses.yes) {
        vscode.commands.executeCommand(
            'vscode.open',
            vscode.Uri.parse('vscode:extension/' + DependentExtensions.remote));
      }
      return false;
    }
    return true;
  }

  static async checkRemoteExtension(channel: vscode.OutputChannel):
      Promise<boolean> {
    const res = await RemoteExtension.isAvailable();
    if (!res) {
      const message = `Remote extension is not available. Please install ${
          DependentExtensions.remote} first.`;
      channelShowAndAppendLine(channel, message);
      return false;
    }
    return true;
  }

  /**
   * Check we are not in remote context before running a command
   * @return true - in local environment; false - in remote environment
   */
  static checkLocalBeforeRunCommand(context: vscode.ExtensionContext): boolean {
    if (RemoteExtension.isRemote(context)) {
      const message =
          `The project is open in a Docker container now. Open a new window and run this command again.`;
      vscode.window.showWarningMessage(message);
      return false;
    }
    return true;
  }
}