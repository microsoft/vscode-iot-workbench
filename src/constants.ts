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
  static readonly codeGeneratorVersion = 'IoTPnPCodeGenVersion';
  static readonly modelRepositoryKeyName = 'IoTPnPModelRepositoryKey';
  static readonly iotPnPPublicRepositoryUrl = 'IoTPnPPublicRepositoryUrl';
  static readonly projectType = 'ProjectType';
  static readonly projectHostType = 'ProjectHostType';
  static readonly workbenchVersion = 'version';
}

export class EventNames {
  static readonly createNewProjectEvent = 'IoTWorkbench.NewProject';
  static readonly configProjectEnvironmentEvent =
      'IoTWorkbench.ConfigProjectEnvironment';
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
  static readonly scaffoldDeviceStubEvent = 'IoTWorkbench.ScaffoldDeviceStub';
  static readonly pnpGetInterfacesEvent = 'IoTWorkbench.IoTPnPGetInterfaces';
  static readonly pnpGetCapabilityModelsEvent =
      'IoTWorkbench.IoTPnPGetCapabilityModels';
  static readonly pnpDeleteModelsEvent = 'IoTWorkbench.IoTPnPDeleteModels';
  static readonly pnpEditModelsEvent = 'IoTWorkbench.IoTPnPEditModels';
  static readonly pnpConnectModelRepoEvent =
      'IoTWorkbench.IoTPnPConnectModelRepo';
  static readonly pnpDisconnectModelRepoEvent =
      'IoTWorkbench.IoTPnPDisconnectModelRepo';
  static readonly pnpCreateInterfaceEvent =
      'IoTWorkbench.IoTPnPCreateInterface';
  static readonly pnpCreateCapabilityModelEvent =
      'IoTWorkbench.IoTPnPCreateCapabilityModel';
  static readonly pnpSubmitMetaModelFilesEvent =
      'IoTWorkbench.IoTPnPSubmitMetaModelFiles';
}

export class FileNames {
  static readonly templateFileName = 'templates.json';
  static readonly boardListFileName = 'boardlist.json';
  static readonly platformListFileName = 'platformlist.json';
  static readonly resourcesFolderName = 'resources';
  static readonly iotworkbenchprojectFileName = '.iotworkbenchproject';
  static readonly cmakeFileName = 'CMakeLists.txt';
  static readonly settingsJsonFileName = 'settings.json';
  static readonly codeGenOptionsFileName = 'codeGenOptions.json';
  static readonly devcontainerFolderName = '.devcontainer';
  static readonly vscodeSettingsFolderName = '.vscode';
  static readonly workspaceConfigFilePath = 'project.code-workspace';
  static readonly iotworkbenchTempFolder = '.iotworkbenchtemp';
  static readonly workspaceExtensionName = '.code-workspace';
  static readonly cacheFolderName = 'cache';
  static readonly outputPathName = 'cmake';
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
  static readonly indentationSpace = 4;
}

export class DependentExtensions {
  static readonly azureFunctions = 'ms-azuretools.vscode-azurefunctions';
  static readonly arduino = 'vsciot-vscode.vscode-arduino';
  static readonly remote = 'ms-vscode-remote.vscode-remote-extensionpack';
}

export enum PlatformType {
  Arduino = 'Arduino',
  EmbeddedLinux = 'Embedded Linux (Preview)',
  Unknown = 'Unknown'
}

export enum DevelopEnvironment {
  Container = 'in container',
  LocalEnv = 'in local environment'
}

export enum TemplateTag {
  General = 'general',
  Digitaltwin = 'digitaltwin',
  DevelopmentEnvironment = 'development_container'
}

export class ContextUris {
  static readonly iotModel = 'http://azureiot.com/v1/contexts/IoTModel.json';
  static readonly interface = 'http://azureiot.com/v1/contexts/Interface.json';
  static readonly capabilityModel =
      'http://azureiot.com/v1/contexts/CapabilityModel.json';
}

export enum ModelType {
  Interface = 'Interface',
  CapabilityModel = 'CapabilityModel',
  InlineInterface = 'InterfaceInstance'
}

export enum OSPlatform {
  WIN32 = 'win32',
  LINUX = 'linux',
  DARWIN = 'darwin'
}