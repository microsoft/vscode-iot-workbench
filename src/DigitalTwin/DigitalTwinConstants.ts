// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export class DigitalTwinConstants {
  static readonly dtPrefix = '[IoT Plug and Play]';
  static readonly codeGenCli = 'IoT Plug and Play CodeGen CLI';
  static readonly codeGenCliFolder = 'iotpnp-codegen';
  static readonly codeGenCliApp = 'dtcodegen';
  static readonly codegenProjectNameRegex =
      new RegExp('^[a-zA-Z_][-a-zA-Z0-9_]*$');
  static readonly codegenProjectNameRegexDescription =
      'alphanumeric, underscore and dash character, and cannot start with number and dash character';
  static readonly codeGenProjectTypeSeperator = '-';
  static readonly cmakeListsFileName = 'CMakeLists.txt';
  static readonly codeGenConfigFileName = '.codeGenConfigs';
}
