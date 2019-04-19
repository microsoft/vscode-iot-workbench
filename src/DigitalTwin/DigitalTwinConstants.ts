// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export class DigitalTwinFileNames {
  static readonly resourcesFolderName = 'resources';
  static readonly deviceModelFolderName = 'devicemodel';
  static readonly graphFileName = 'graph.json';
  static readonly interfaceFileName = 'Interface.json';
  static readonly capabilityModelFileName = 'CapabilityModel.json';
  static readonly settingsJsonFileName = 'settings.json';
  static readonly vscodeSettingsFolderName = '.vscode';
  static readonly sampleInterfaceName = 'sample.interface.json';
  static readonly sampleCapabilityModelName = 'sample.capabilitymodel.json';
  static readonly schemaFolderName = 'schemas';
  static readonly defaultInterfaceName = 'myInterface';
  static readonly defaultCapabilityModelName = 'myCapabilityModel';
  static readonly etagCacheFileName = 'etagCache.json';
}

export class DigitalTwinConstants {
  static readonly repoConnectionStringTemplate =
      'HostName=<Host Name>;RepositoryId=<repository id>;SharedAccessKeyName=<Shared AccessKey Name>;SharedAccessKey=<access Key>';
  static readonly interfaceSuffix = '.interface.json';
  static readonly capabilityModelSuffix = '.capabilitymodel.json';
  static readonly dtPrefix = '[Azure Digital Twins]';
}

export class CodeGenConstants {
  static readonly codeGeneratorToolPath = 'pnp-codegen';
}