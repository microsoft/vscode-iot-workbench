
import * as vscode from 'vscode';
import {CppCodeGeneratorBase} from './Interfaces/CppCodeGeneratorBase';

export class CppCodeGenGeneralImpl extends CppCodeGeneratorBase {
  constructor(context: vscode.ExtensionContext, channel: vscode.OutputChannel) {
    super(context, channel);
  }

  async GenerateCode(
      targetPath: string, filePath: string, fileCoreName: string,
      connectionString: string): Promise<boolean> {
    // Invoke PnP toolset to generate the code
    const retvalue =
        this.GenerateCppCodeCore(targetPath, filePath, connectionString);
    return retvalue;
  }
}