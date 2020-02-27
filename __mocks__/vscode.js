// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

// Class
const Uri = {
  fsPath: "defaultPath",
  file: jest.fn()
};

// Interface
const OutputChannel = {
  appendLine: jest.fn(),
  show: jest.fn(),
  dispose: jest.fn()
};

const ExtensionContext = {
  asAbsolutePath: jest.fn()
};

const WorkspaceFolder = {
  uri: Uri
};

const QuickPickOptions = {};

const QuickPickItem = {};

const OpenDialogOptions = {};

const InputBoxOptions = {};

// Enum
const ConfigurationTarget = {
  Global: 1,
  workspace: 2,
  WorkspaceFolder: 3
};

// Namespace
const window = {
  createOutputChannel: jest.fn(() => OutputChannel),
  showQuickPick: jest.fn(items => items[0]),
  showOpenDialog: jest.fn(),
  showInputBox: jest.fn(),
  showTextDocument: jest.fn(),
  showInformationMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showErrorMessage: jest.fn()
};

const commands = {
  executeCommand: jest.fn()
};

const workspace = {
  workspaceFolders: undefined
};

const vscode = {
  // Class
  Uri,

  // Interface
  OutputChannel,
  ExtensionContext,
  WorkspaceFolder,
  QuickPickOptions,
  QuickPickItem,
  OpenDialogOptions,
  InputBoxOptions,

  // Enum
  ConfigurationTarget,

  // Namespace
  window,
  commands,
  workspace
};

module.exports = vscode;
