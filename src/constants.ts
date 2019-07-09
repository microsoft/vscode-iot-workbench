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
  static readonly projectType = 'ProjectType';
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
  static readonly openExamplePageEvent = 'IoTWorkbench.OpenExamplePage';
  static readonly loadExampleEvent = 'IoTWorkbench.loadExample';
  static readonly detectBoard = 'IoTWorkbench.DetectBoard';
  static readonly generateOtaCrc = 'IoTWorkbench.GenerateOtaCrc';
  static readonly nsatsurvery = 'IoTWorkbench.NSATSurvey';
  static readonly selectSubscription = 'IoTWorkbench.SelectSubscription';
  static readonly openTutorial = 'IoTWorkbench.OpenTutorial';
  static readonly projectLoadEvent = 'IoTWorkbench.ProjectLoadEvent';
}

export class FileNames {
  static readonly templateFileName = 'templates.json';
  static readonly boardListFileName = 'boardlist.json';
  static readonly platformListFileName = 'platformlist.json';
  static readonly resourcesFolderName = 'resources';
  static readonly iotworkbenchprojectFileName = '.iotworkbenchproject';
  static readonly settingsJsonFileName = 'settings.json';
  static readonly devcontainerFolderName = '.devcontainer';
  static readonly vscodeSettingsFolderName = '.vscode';
  static readonly workspaceExtensionName = '.code-workspace';
  static readonly outputPathName = '.build';
  static readonly templatesFolderName = 'templates';
  static readonly templateFiles = 'templatefiles.json';
}

export enum OperationType {
  Compile = 'Compile device code',
  Upload = 'Upload device code'
}

export enum AzureFunctionsLanguage {
  CSharpScript = 'C#Script',
  JavaScript = 'JavaScript',
  CSharpLibrary = 'C#'
}

export enum ScaffoldType {
  Local = 'local',
  Workspace = 'workspace'
}

export class AzureComponentsStorage {
  static readonly folderName = '.azurecomponent';
  static readonly fileName = 'azureconfig.json';
}

export class GlobalConstants {
  static readonly extensionId = 'vsciot-vscode.vscode-iot-workbench';
}

export class DependentExtensions {
  static readonly azureFunctions = 'ms-azuretools.vscode-azurefunctions';
  static readonly arduino = 'vsciot-vscode.vscode-arduino';
  static readonly remote = 'ms-vscode-remote.vscode-remote-extensionpack';
}

export enum PlatformType {
  ARDUINO = 'Arduino',
  EMBEDDEDLINUX = 'Embedded Linux (Preview)'
}

export enum DevelopEnvironment {
  CONTAINER = 'in container',
  LOCAL_ENV = 'in local environment'
}