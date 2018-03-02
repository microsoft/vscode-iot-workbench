import * as vscode from 'vscode';
import {extensionName} from './Interfaces/Api';
import { AzureAccount } from '../azure-account.api';

export function getExtension(name: extensionName) {
  switch (name) {
    case extensionName.Toolkit:
      const toolkit =
          vscode.extensions.getExtension('vsciot-vscode.azure-iot-toolkit');
      return toolkit ? toolkit.exports : undefined;
    case extensionName.AzureAccount:
      const azureAccount =
          vscode.extensions.getExtension<AzureAccount>('ms-vscode.azure-account');
      return azureAccount ? azureAccount.exports : undefined;
    default:
      return undefined;
  }
}

export async function loginAzure(): Promise<boolean> {
  const azureAccount = getExtension(extensionName.AzureAccount);
  if (azureAccount === undefined) {
    throw new Error('Azure account extension is not found. Please install it from Marketplace.');
  }

  // Sign in Azure
  if (azureAccount.status !== "LoggedIn") {
    await vscode.commands.executeCommand("azure-account.login");
  }

  return true;
}