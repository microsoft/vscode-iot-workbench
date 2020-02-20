// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

const OutputChannel = {
  appendLine: jest.fn(),
  show: jest.fn(),
  dispose: jest.fn()
};

const ExtensionContext = {
  asAbsolutePath: jest.fn(p => p)
};

const window = {
  createOutputChannel: jest.fn(() => OutputChannel),
  showInformationMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showErrorMessage: jest.fn()
};

const commands = {
  executeCommand: jest.fn()
};

const vscode = {
  window,
  commands,
  OutputChannel,
  ExtensionContext
};

module.exports = vscode;
