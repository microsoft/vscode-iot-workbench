
'use strict';

import * as vscode from 'vscode';
import {DependentExtensions, GlobalConstants} from '../constants';

export class RemoteExtension {
  static isRemote(context: vscode.ExtensionContext) {
    // tslint:disable-next-line: no-any
    return (vscode as any)
               .extensions.getExtension(GlobalConstants.extensionId)
               .extensionKind === vscode.ExtensionKind.Workspace;
  }

  static async isAvailable(): Promise<boolean> {
    if (!vscode.extensions.getExtension(DependentExtensions.remote)) {
      const choice = await vscode.window.showInformationMessage(
          'Remote extension is required for the current project. Do you want to install it from marketplace?',
          'Yes', 'No');
      if (choice === 'Yes') {
        vscode.commands.executeCommand(
            'vscode.open',
            vscode.Uri.parse('vscode:extension/' + DependentExtensions.remote));
      }
      return false;
    }
    return true;
  }

  static async checkRemoteExtension(): Promise<boolean> {
    return await RemoteExtension.isAvailable();
  }
}