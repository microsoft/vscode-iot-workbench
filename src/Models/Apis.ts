// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from "vscode";

import { AzureAccountCommands, VscodeCommands } from "../common/Commands";
import { DependentExtensionNotFoundError } from "../common/Error/OperationFailedErrors/DependentExtensionNotFoundError";
import { ExtensionName, ExtensionNameIdMap } from "./Interfaces/Api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getExtension(name: ExtensionName): any {
  const extensionId = ExtensionNameIdMap.get(name);
  if (extensionId) {
    const extension = vscode.extensions.getExtension(extensionId);
    if (extension) {
      switch (name) {
        case ExtensionName.AzureAccount:
        case ExtensionName.Toolkit:
          return extension.exports ? extension.exports : undefined;
        default:
          return extension;
      }
    }
  }
  return undefined;
}

export async function checkAzureLogin(): Promise<boolean> {
  const azureAccount = getExtension(ExtensionName.AzureAccount);
  if (!azureAccount) {
    throw new DependentExtensionNotFoundError("check Azure Login", ExtensionName.AzureAccount);
  }

  // Sign in Azure
  if (azureAccount.status !== "LoggedIn") {
    await vscode.commands.executeCommand(AzureAccountCommands.Login);
  }

  return true;
}

export async function checkExtensionAvailable(extensionName: ExtensionName): Promise<boolean> {
  if (!getExtension(extensionName)) {
    const choice = await vscode.window.showInformationMessage(
      `${extensionName} extension is required for the current project. Do you want to install it from marketplace?`,
      "Yes",
      "No"
    );
    if (choice === "Yes") {
      vscode.commands.executeCommand(
        VscodeCommands.VscodeOpen,
        vscode.Uri.parse(("vscode:extension/" + ExtensionNameIdMap.get(extensionName)) as string)
      );
    }
    return false;
  }

  return true;
}
