// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export class PnPFileNames {
  static readonly resourcesFolderName = 'resources';
  static readonly deviceModelFolderName = 'DeviceModel';
  static readonly graphFileName = 'graph.json';
  static readonly interfaceFileName = 'Interface.json';
  static readonly capabilityModelFileName = 'CapabilityModel.json';
  static readonly iotworkbenchprojectFileName = '.vscode-pnp';
  static readonly settingsJsonFileName = 'settings.json';
  static readonly vscodeSettingsFolderName = '.vscode';
  static readonly sampleInterfaceName = 'sample.interface.json';
  static readonly sampleCapabilityModelName = 'sample.capabilitymodel.json';
  static readonly schemaFolderName = 'schemas';
  static readonly defaultInterfaceName = 'myInterface';
  static readonly defaultCapabilityModelName = 'myCapabilityModel';
}

export class PnPConstants {
  static readonly modelRepositoryKeyName = 'ModelRepositoryKey';
  static readonly repoConnectionStringTemplate =
      'HostName=<Host Name>;SharedAccessKeyName=<Shared AccessKey Name>;SharedAccessKey=<access Key>';
  static readonly interfaceSuffix = '.interface.json';
  static readonly capabilityModelSuffix = '.capabilitymodel.json';
}

export class CodeGenConstants {
  static readonly codeGeneratorToolPath = 'pnp-codegen';
  static readonly codeGeneratorVersionKey = 'pnp/codeGenVersion';
}