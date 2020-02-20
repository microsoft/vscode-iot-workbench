// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from "vscode";

import { AzureAccount } from "../azure-account.api";
import { AzureAccountCommands, VscodeCommands } from "../common/Commands";
import { DependentExtensionNotFoundError } from "../common/Error/OperationFailedErrors/DependentExtensionNotFoundError";
import { ExtensionName, DependentExtensions, ExtensionNameIdMap } from "./Interfaces/Api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getExtension(name: ExtensionName): any {
  // }
  switch (name) {
    case ExtensionName.AzureAccount: {
      const azureAccount = vscode.extensions.getExtension<AzureAccount>(DependentExtensions.azureAccount);
      return azureAccount ? azureAccount.exports : undefined;
    }
    case ExtensionName.Toolkit:
    case ExtensionName.Remote:
    case ExtensionName.AzureFunctions:
    case ExtensionName.Arduino: {
      const extension = vscode.extensions.getExtension(ExtensionNameIdMap[name] as string);
      return extension ? extension.exports : undefined;
    }
    default: {
      return undefined;
    }
  }
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
        vscode.Uri.parse(("vscode:extension/" + ExtensionNameIdMap[ExtensionName.Arduino]) as string)
      );
    }
    return false;
  }

  return true;
}
