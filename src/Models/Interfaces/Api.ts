// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export enum ExtensionName {
  Toolkit = "Azure IoT Hub Toolkit",
  AzureAccount = "Azure Account",
  Remote = "Remote Development",
  AzureFunctions = "Azure Functions",
  Arduino = "Arduino"
}

export const ExtensionNameIdMap: Map<ExtensionName, string> = new Map<ExtensionName, string>([
  [ExtensionName.Toolkit, "vsciot-vscode.azure-iot-toolkit"],
  [ExtensionName.AzureAccount, "ms-vscode.azure-account"],
  [ExtensionName.Remote, "ms-vscode-remote.vscode-remote-extensionpack"],
  [ExtensionName.AzureFunctions, "ms-azuretools.vscode-azurefunctions"],
  [ExtensionName.Arduino, "vsciot-vscode.vscode-arduino"]
]);
