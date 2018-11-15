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
  static readonly shownHelpPage = 'ShownHelpPage';
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
  static readonly generateOtaCrc = 'IoTWorkbench.GenerateOtaCrc';
  static readonly nsatsurvery = 'IoTWorkbench.NSATSurvey';
  static readonly scaffoldDeviceStubEvent = 'IoTWorkbench.ScaffoldDeviceStub';
}

export class ContentView {
  static readonly workbenchContentProtocol = 'iot-workbench';
  static readonly workbenchExampleURI = 'iot-workbench://example';
  static readonly workbenchHelpURI = 'iot-workbench://help';
}

export class FileNames {
  static readonly templateFileName = 'template.json';
  static readonly boardListFileName = 'boardlist.json';
  static readonly resourcesFolderName = 'resources';
  static readonly iotworkbenchprojectFileName = '.iotworkbenchproject';
  static readonly settingsJsonFileName = 'settings.json';
  static readonly vscodeSettingsFolderName = '.vscode';
  static readonly workspaceConfigFilePath = 'project.code-workspace';
  static readonly iotworkbenchTempFolder = '.iotworkbenchtemp';
  static readonly workspaceExtensionName = '.code-workspace';
}

export enum AzureFunctionsLanguage {
  CSharpScript = 'C#Script',
  JavaScript = 'JavaScript',
  CSharpLibrary = 'C#'
}

export class AzureComponentsStorage {
  static readonly folderName = '.azurecomponent';
  static readonly fileName = 'azureconfig.json';
}

export class GlobalConstants {
  static readonly extensionId = 'vsciot-vscode.vscode-iot-workbench';
}