// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';

import {AzureAccount} from '../azure-account.api';

import {ExtensionName} from './Interfaces/Api';

export function getExtension(name: ExtensionName) {
  switch (name) {
    case ExtensionName.Toolkit:
      const toolkit =
          vscode.extensions.getExtension('vsciot-vscode.azure-iot-toolkit');
      return toolkit ? toolkit.exports : undefined;
    case ExtensionName.AzureAccount:
      const azureAccount = vscode.extensions.getExtension<AzureAccount>(
          'ms-vscode.azure-account');
      return azureAccount ? azureAccount.exports : undefined;
    case ExtensionName.DigitalTwins:
      const digitalTwins =
          vscode.extensions.getExtension('vsciot-vscode.azure-digital-twins');
      return digitalTwins ? digitalTwins.exports : undefined;
    default:
      return undefined;
  }
}

export async function checkAzureLogin(): Promise<boolean> {
  const azureAccount = getExtension(ExtensionName.AzureAccount);
  if (!azureAccount) {
    throw new Error(
        'Azure account extension is not found. Please install it from Marketplace.');
  }

  // Sign in Azure
  if (azureAccount.status !== 'LoggedIn') {
    await vscode.commands.executeCommand('azure-account.login');
  }

  return true;
}