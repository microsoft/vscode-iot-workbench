// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

const path = require("path");

// Class
const Uri = {
  fsPath: "defaultPath",
  file: jest.fn()
};

const Diagnostic = jest.fn((range, message, severity) => {
  return {
    range,
    message,
    severity
  };
});

const Range = jest.fn();

// Interface
const OutputChannel = {
  appendLine: jest.fn(),
  show: jest.fn(),
  dispose: jest.fn()
};

const ExtensionContext = {
  asAbsolutePath: jest.fn(p => {
    const rootPath = path.resolve(__dirname, "..");
    return path.join(rootPath, p);
  })
};

const WorkspaceFolder = {
  uri: Uri
};

const TextDocument = {
  uri: Uri,
  getText: jest.fn(),
  positionAt: jest.fn()
};

const DiagnosticCollection = {
  set: jest.fn(),
  delete: jest.fn()
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

const DiagnosticSeverity = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3
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
  Diagnostic,
  Range,

  // Interface
  OutputChannel,
  ExtensionContext,
  WorkspaceFolder,
  QuickPickOptions,
  QuickPickItem,
  OpenDialogOptions,
  InputBoxOptions,
  TextDocument,
  DiagnosticCollection,

  // Enum
  ConfigurationTarget,
  DiagnosticSeverity,

  // Namespace
  window,
  commands,
  workspace
};

module.exports = vscode;
