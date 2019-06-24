
'use strict';

import * as path from 'path';
import * as vscode from 'vscode';
import {DependentExtensions} from '../constants';

export class RemoteExtension {
  // [TODO] A rough version provided by Chuck. Will be removed when service API is ready.
  // Check whether the iot-workbench extension is currently in remote container or local
  static isRemote(context: vscode.ExtensionContext) {
    if (((vscode as any).ExtensionExecutionContext && (context as any).executionContext ===(vscode as any).ExtensionExecutionContext.Remote) ||
        (process.argv[0].indexOf(`${path.sep}.vscode-remote${path.sep}`) > 0)) {
        return true;
    }
    return false;
  }

  static async isAvailable(): Promise<boolean> {
    if (!vscode.extensions.getExtension(DependentExtensions.remote)) {
      const choice = await vscode.window.showInformationMessage(
          'Remote extension is required for the current project. Do you want to install it from marketplace?',
          'Yes', 'No');
      if (choice === 'Yes') {
        vscode.commands.executeCommand(
            'vscode.open',
            vscode.Uri.parse(
                'vscode:extension/' + DependentExtensions.remote));
      }
      return false;
    }
    return true;
  }

  static async checkRemoteExtension(): Promise<boolean> {
    return await RemoteExtension.isAvailable();
  }

}