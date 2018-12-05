import * as vscode from 'vscode';
import {AnsiCCodeGeneratorBase} from './Interfaces/AnsiCCodeGeneratorBase';

export class AnsiCCodeGenGeneralImpl extends AnsiCCodeGeneratorBase {
  constructor(context: vscode.ExtensionContext, channel: vscode.OutputChannel) {
    super(context, channel);
  }

  async GenerateCode(
      targetPath: string, filePath: string, fileCoreName: string,
      connectionString: string): Promise<boolean> {
    // Invoke PnP toolset to generate the code
    const retvalue =
        this.GenerateAnsiCCodeCore(targetPath, filePath, connectionString);
    return retvalue;
  }
}
