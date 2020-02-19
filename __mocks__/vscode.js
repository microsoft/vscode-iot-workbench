const OutputChannel = {
  appendLine: jest.fn(),
  show: jest.fn(),
  dispose: jest.fn()
};

const window = {
  createOutputChannel: jest.fn(() => OutputChannel)
};

const vscode = {
  window,
  OutputChannel
};

module.exports = vscode;
