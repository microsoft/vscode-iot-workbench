import * as vscode from 'vscode';

// mock of the extension context for vscode
class TestExtensionContext implements vscode.ExtensionContext {
  subscriptions: Array<{dispose(): {}}>;
  workspaceState: vscode.Memento;
  globalState: vscode.Memento;
  extensionPath: string;
  storagePath: string;

  asAbsolutePath(relativePath: string): string {
    return '';
  }
}


export {TestExtensionContext};