import * as vscode from "vscode";

class DummyMemento implements vscode.Memento {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  get<T>(_key: string): Promise<T | undefined> {
    return Promise.resolve(undefined);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  update(_key: string, _value: any): Promise<void> {
    return Promise.resolve();
  }
}

// mock of the extension context for vscode
class TestExtensionContext implements vscode.ExtensionContext {
  globalStoragePath = "";
  subscriptions: Array<{ dispose(): {} }> = [];
  workspaceState: vscode.Memento = new DummyMemento();
  globalState: vscode.Memento = new DummyMemento();
  extensionPath = "";
  storagePath = "";
  logPath = "";

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  asAbsolutePath(_relativePath: string): string {
    return "";
  }
}

export { DummyMemento, TestExtensionContext };
