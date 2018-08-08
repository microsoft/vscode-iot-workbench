// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export class ConfigKey {
  static readonly devicePath = 'DevicePath';
  static readonly iotHubConnectionString = 'iothubConnectionString';
  static readonly iotHubDeviceConnectionString = 'iothubDeviceConnectionString';
  static readonly eventHubConnectionString = 'eventHubConnectionString';
  static readonly eventHubConnectionPath = 'eventHubConnectionPath';
  static readonly functionAppId = 'functionAppId';
  static readonly functionPath = 'FunctionPath';
  static readonly boardId = 'BoardId';
  static readonly asaPath = 'StreamAnalyticsPath';
}

export class EventNames {
  static readonly createNewProjectEvent = 'IoTWorkbench.NewProject';
  static readonly azureProvisionEvent = 'IoTWorkbench.AzureProvision';
  static readonly azureDeployEvent = 'IoTWorkbench.AzureDeploy';
  static readonly createAzureFunctionsEvent =
      'IoTWorkbench.CreateAzureFunctions';
  static readonly deviceCompileEvent = 'IoTWorkbench.DeviceCompile';
  static readonly deviceUploadEvent = 'IoTWorkbench.DeviceUpload';
  static readonly devicePackageEvent = 'IoTWorkbench.DevicePackage';
  static readonly configDeviceSettingsEvent =
      'IoTWorkbench.ConfigDeviceSettingsEvent';
  static readonly loadExampleEvent = 'IoTWorkbench.loadExample';
  static readonly detectBoard = 'IoTWorkbench.DetectBoard';
}

export class ContentView {
  static readonly workbenchContentProtocol = 'iot-workbench';
  static readonly workbenchExampleURI = 'iot-workbench://example';
}

export class FileNames {
  static readonly templateFileName = 'template.json';
  static readonly boardListFileName = 'boardlist.json';
  static readonly resourcesFolderName = 'resources';
  static readonly iotworkbenchprojectFileName = '.iotworkbenchproject';
  static readonly settingsJsonFileName = 'settings.json';
  static readonly vscodeSettingsFolderName = '.vscode';
}

export enum AzureFunctionsLanguage {
  CSharpScript = 'C#Script',
  JavaScript = 'JavaScript'
}

export class AzureComponentsStorage {
  static readonly folderName = '.azurecomponent';
  static readonly fileName = 'azureconfig.json';
}
