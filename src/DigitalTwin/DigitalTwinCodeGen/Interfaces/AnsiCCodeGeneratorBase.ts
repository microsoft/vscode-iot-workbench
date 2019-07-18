import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import * as utils from '../../../utils';
import {CodeGenConstants} from '../../DigitalTwinConstants';

import {CodeGenerator} from './CodeGenerator';

export abstract class AnsiCCodeGeneratorBase implements CodeGenerator {
  abstract async GenerateCode(
      targetPath: string, filePath: string, capabilityModelName: string,
      interfaceDir: string): Promise<boolean>;

  constructor(
      protected context: vscode.ExtensionContext,
      protected channel: vscode.OutputChannel) {}

  async GenerateAnsiCCodeCore(
      targetPath: string, filePath: string,
      interfaceDir: string): Promise<boolean> {
    // Invoke DigitalTwinCodeGen toolset to generate the code
    const platform = os.platform();
    const homeDir = os.homedir();
    const cmdPath = path.join(homeDir, CodeGenConstants.codeGeneratorToolPath);
    let codeGenCommand = '';
    if (platform === 'win32') {
      codeGenCommand = 'DigitalTwinCodeGen.exe';
    } else {
      codeGenCommand = './DigitalTwinCodeGen';
    }

    const command = `${codeGenCommand} scaffold  --dcm "${
        filePath}" --language ansic --output "${targetPath}" --interfaceDir "${
        interfaceDir}"`;

    let message = 'IoT Workbench: scaffold code stub.';
    utils.channelShowAndAppendLine(this.channel, message);
    await utils.runCommand(command, [], cmdPath, this.channel);
    message = 'IoT Workbench: scaffold code stub completed.';
    utils.channelShowAndAppendLine(this.channel, message);
    return true;
  }
}
