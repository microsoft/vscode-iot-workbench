import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import * as utils from '../../../utils';
import {CodeGenConstants} from '../../PnPConstants';

import {CodeGenerator} from './CodeGenerator';

export abstract class AnsiCCodeGeneratorBase implements CodeGenerator {
  async abstract GenerateCode(
      targetPath: string, filePath: string, fileCoreName: string,
      connectionString: string): Promise<boolean>;

  constructor(
      protected context: vscode.ExtensionContext,
      protected channel: vscode.OutputChannel) {}

  async GenerateAnsiCCodeCore(
      targetPath: string, filePath: string,
      connectionString: string): Promise<boolean> {
    // Invoke PnP toolset to generate the code
    const platform = os.platform();
    const homeDir = os.homedir();
    let cmdPath = '';
    if (platform === 'win32') {
      cmdPath = path.join(homeDir, CodeGenConstants.codeGeneratorToolPath);
    } else {
      vscode.window.showWarningMessage(
          `Currently, Plug & Play code generator does not support ${platform}`);
      return false;
    }

    const command = `PnPCodeGen.exe scaffold  --jsonldUri "${
        filePath}" --language ansic --output "${
        targetPath}" --connectionString "${connectionString}"`;

    this.channel.show();
    this.channel.appendLine('IoT Workbench: scaffold code stub.');
    await utils.runCommand(command, cmdPath, this.channel);
    this.channel.appendLine('IoT Workbench: scaffold code stub completed.');
    return true;
  }
}