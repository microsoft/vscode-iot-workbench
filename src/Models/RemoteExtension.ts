
'use strict';

import * as path from 'path';
import * as vscode from 'vscode';
import {DependentExtensions} from '../constants';
import {DialogResponses} from '../DialogResponses';
import {channelShowAndAppendLine} from '../utils';

export class RemoteExtension {
  // [TODO] A rough version provided by Chuck. Will be removed when service API
  // is ready. Check whether the iot-workbench extension is currently in remote
  // container or local
  static isRemote(context: vscode.ExtensionContext) {
    // tslint:disable-next-line: no-any
    if (((vscode as any).ExtensionExecutionContext &&
         // tslint:disable-next-line: no-any
         (context as any).executionContext ===
             // tslint:disable-next-line: no-any
             (vscode as any).ExtensionExecutionContext.Remote) ||
        (process.argv[0].indexOf(`${path.sep}.vscode-remote${path.sep}`) > 0)) {
      return true;
    }
    return false;
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
  static checkNotRemoteBeforeRunCommand(context: vscode.ExtensionContext):
      boolean {
    if (RemoteExtension.isRemote(context)) {
      const message =
          `The project is open in a Docker container now. Open a new window and run this command again.`;
      vscode.window.showWarningMessage(message);
      return false;
    }
    return true;
  }
}