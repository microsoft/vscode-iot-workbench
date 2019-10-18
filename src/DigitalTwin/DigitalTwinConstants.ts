// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export class DigitalTwinFileNames {
  static readonly graphFileName = 'graph.json';
  static readonly interfaceFileName = 'Interface.json';
  static readonly capabilityModelFileName = 'CapabilityModel.json';
  static readonly iotModelFileName = 'IoTModel.json';
  static readonly settingsJsonFileName = 'settings.json';
  static readonly vscodeSettingsFolderName = '.vscode';
  static readonly sampleInterfaceName = 'sample.interface.json';
  static readonly sampleCapabilityModelName = 'sample.capabilitymodel.json';
  static readonly schemaFolderName = 'schemas';
  static readonly etagCacheFileName = 'etagCache.json';
  static readonly devicemodelTemplateFolderName = 'devicemodel';
  static readonly deviceConnectionListFileName = 'deviceconnectionlist.json';
  static readonly utilitiesFolderName = 'utilities';
}

export class DigitalTwinConstants {
  static readonly repoConnectionStringTemplate =
      'HostName=<Host Name>;RepositoryId=<repository id>;SharedAccessKeyName=<Shared AccessKey Name>;SharedAccessKey=<access Key>';
  static readonly interfaceSuffix = '.interface.json';
  static readonly capabilityModelSuffix = '.capabilitymodel.json';
  static readonly jsonSuffix = '.json';
  static readonly dtPrefix = '[IoT Plug and Play]';
  static readonly apiVersion = '2019-07-01-Preview';
  static readonly productName = 'IoT Plug and Play';

  static readonly codeGenCli = 'IoT Plug and Play CodeGen Cli';
  static readonly codeGenCliFolder = 'iotpnp-codegen';
  static readonly codeGenCliApp = 'dtcodegen';

  static readonly dtidPlaceholder = '{DigitalTwinIdentifier}';

  static readonly dtidSegmentRegex = new RegExp('^[a-zA-Z_][a-zA-Z0-9_]*$');
  static readonly dtidSegmentRegexDescription =
      'alphanumeric and underscore, and cannot start with number';

  static readonly codegenProjectNameRegex =
      new RegExp('^[a-zA-Z_][-a-zA-Z0-9_]*$');
  static readonly codegenProjectNameRegexDescription =
      'alphanumeric, underscore and dash character, and cannot start with number and dash character';

  static readonly codeGenProjectTypeSeperator = '-';
  static readonly cmakeListsFileName = 'CMakeLists.txt';
}

export class DTDLKeywords {
  static readonly typeValueInterface = 'Interface';
  static readonly typeValueDCM = 'CapabilityModel';
  static readonly inlineInterfaceKeyName = 'interfaceSchema';
}
