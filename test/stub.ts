import * as vscode from 'vscode';

class DummyMemento implements vscode.Memento {
  get<T>(key: string): Promise<T|undefined> {
    return Promise.resolve(undefined);
  }

  // tslint:disable-next-line: no-any
  update(key: string, value: any): Promise<void> {
    return Promise.resolve();
  }
}

// mock of the extension context for vscode
class TestExtensionContext implements vscode.ExtensionContext {
  subscriptions: Array<{dispose(): {}}> = [];
  workspaceState: vscode.Memento = new DummyMemento();
  globalState: vscode.Memento = new DummyMemento();
  extensionPath = '';
  storagePath = '';

  asAbsolutePath(relativePath: string): string {
    return '';
  }
}


export {DummyMemento, TestExtensionContext};