import * as vscode from "vscode";
import * as fs from "fs";

export class WorkbenchExtension {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  private static extension: vscode.Extension<any> | undefined;

  static getExtension(
    context: vscode.ExtensionContext
  ): // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  vscode.Extension<any> | undefined {
    if (!WorkbenchExtension.extension) {
      const extensionId = WorkbenchExtension.getExtensionId(context);
      WorkbenchExtension.extension = vscode.extensions.getExtension(extensionId);
    }
    return WorkbenchExtension.extension;
  }

  private static getExtensionId(context: vscode.ExtensionContext): string {
    // Get extensionId from package.json
    const packageJsonPath = context.asAbsolutePath("./package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const extensionId = packageJson.publisher + "." + packageJson.name;

    if (!extensionId) {
      throw new Error("Fail to get extension id from package.json.");
    }
    return extensionId;
  }
}
