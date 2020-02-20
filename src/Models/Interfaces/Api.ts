// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export enum ExtensionName {
  Toolkit = "Azure IoT Hub Toolkit",
  AzureAccount = "Azure Account",
  Remote = "Remote Development",
  AzureFunctions = "Azure Functions",
  Arduino = "Arduino"
}

export class DependentExtensions {
  static readonly azureFunctions = "ms-azuretools.vscode-azurefunctions";
  static readonly arduino = "vsciot-vscode.vscode-arduino";
  static readonly remote = "ms-vscode-remote.vscode-remote-extensionpack";
  static readonly toolkit = "vsciot-vscode.azure-iot-toolkit";
  static readonly azureAccount = "ms-vscode.azure-account";
}

export const ExtensionNameIdMap: Record<ExtensionName, DependentExtensions> = {
  [ExtensionName.Arduino]: DependentExtensions.arduino,
  [ExtensionName.AzureAccount]: DependentExtensions.azureAccount,
  [ExtensionName.AzureFunctions]: DependentExtensions.azureFunctions,
  [ExtensionName.Remote]: DependentExtensions.remote,
  [ExtensionName.Toolkit]: DependentExtensions.toolkit
};
