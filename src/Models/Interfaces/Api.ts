// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export enum ExtensionName {
  Toolkit = "Azure IoT Hub Toolkit",
  AzureAccount = "Azure Account",
  Remote = "Remote Development",
  AzureFunctions = "Azure Functions",
  Arduino = "Arduino"
}

export enum ExtensionId {
  AzureFunctions = "ms-azuretools.vscode-azurefunctions",
  Arduino = "vsciot-vscode.vscode-arduino",
  Remote = "ms-vscode-remote.vscode-remote-extensionpack",
  Toolkit = "vsciot-vscode.azure-iot-toolkit",
  AzureAccount = "ms-vscode.azure-account"
}

export const ExtensionNameIdMap: Map<ExtensionName, ExtensionId> = new Map<ExtensionName, ExtensionId>([
  [ExtensionName.Toolkit, ExtensionId.Toolkit],
  [ExtensionName.AzureAccount, ExtensionId.AzureAccount],
  [ExtensionName.Remote, ExtensionId.Remote],
  [ExtensionName.AzureFunctions, ExtensionId.AzureFunctions],
  [ExtensionName.Arduino, ExtensionId.Arduino]
]);
