// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

const OutputChannel = {
  appendLine: jest.fn(),
  show: jest.fn(),
  dispose: jest.fn()
};

const ExtensionContext = {
  asAbsolutePath: jest.fn()
};

const Uri = {
  fsPath: "defaultPath",
  file: jest.fn()
};

const WorkspaceFolder = {
  uri: Uri
};

const QuickPickOptions = {};

const QuickPickItem = {};

const OpenDialogOptions = {};

const window = {
  createOutputChannel: jest.fn(() => OutputChannel),
  showQuickPick: jest.fn(items => items[0]),
  showOpenDialog: jest.fn(),
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
  OutputChannel,
  ExtensionContext,
  Uri,
  WorkspaceFolder,
  QuickPickOptions,
  QuickPickItem,
  OpenDialogOptions,
  window,
  commands,
  workspace
};

module.exports = vscode;
