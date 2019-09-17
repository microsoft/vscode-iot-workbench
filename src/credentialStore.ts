// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

'use strict';

import * as keytarType from 'keytar';
import * as vscode from 'vscode';
import { GlobalConstants } from './constants';

export class CredentialStore {
  static async getCredential(credentialName: string): Promise<string | null> {
    try {
      return this.keytar.getPassword(
        GlobalConstants.extensionId,
        credentialName
      );
    } catch (error) {
      return null;
    }
  }

  static async setCredential(credentialName: string, credentialValue: string) {
    await this.keytar.setPassword(
      GlobalConstants.extensionId,
      credentialName,
      credentialValue
    );
  }

  static async deleteCredential(credentialName: string): Promise<boolean> {
    return this.keytar.deletePassword(
      GlobalConstants.extensionId,
      credentialName
    );
  }

  private static keytar: typeof keytarType = CredentialStore.getCoreNodeModule(
    'keytar'
  );

  /**
   * Helper function that returns a node module installed with VSCode, or null
   * if it fails.
   */
  private static getCoreNodeModule(moduleName: string) {
    try {
      return require(`${vscode.env.appRoot}/node_modules.asar/${moduleName}`);
    } catch (err) {}

    try {
      return require(`${vscode.env.appRoot}/node_modules/${moduleName}`);
    } catch (err) {}

    return null;
  }
}
