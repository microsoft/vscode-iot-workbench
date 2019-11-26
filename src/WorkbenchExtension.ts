'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';

export class WorkbenchExtension {
  // tslint:disable-next-line: no-any
  private static extension: vscode.Extension<any>|undefined;

  private constructor(context: vscode.ExtensionContext) {
    // Get extensionId from package.json
    const packageJsonPath = context.asAbsolutePath('./package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const extensionId = packageJson.publisher + '.' + packageJson.name;

    if (!extensionId) {
      throw new Error('Fail to get extensionId from package.json.');
    }
    WorkbenchExtension.extension = vscode.extensions.getExtension(extensionId);
  }

  // tslint:disable-next-line: no-any
  static getExtension(context: vscode.ExtensionContext):
      vscode.Extension<any>|undefined {
    if (!WorkbenchExtension.extension) {
      // tslint:disable-next-line: no-unused-expression
      new WorkbenchExtension(context);
    }
    return WorkbenchExtension.extension;
  }
}