import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import * as utils from '../../../utils';
import {CodeGenConstants, DigitalTwinConstants} from '../../DigitalTwinConstants';

import {CodeGenerator} from './CodeGenerator';

export abstract class AnsiCCodeGeneratorBase implements CodeGenerator {
  abstract async GenerateCode(
      targetPath: string, filePath: string, capabilityModelName: string,
      dcmId: string, interfaceDir: string): Promise<boolean>;

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
      codeGenCommand = `${CodeGenConstants.codeGeneratorToolName}.exe`;
    } else {
      codeGenCommand = `./${CodeGenConstants.codeGeneratorToolName}`;
    }

    const command = `${codeGenCommand} scaffold  --dcm "${
        filePath}" --language ansic --output "${targetPath}" --interfaceDir "${
        interfaceDir}"`;

    let message = `${DigitalTwinConstants.dtPrefix} Scaffold code stub.`;
    utils.channelShowAndAppendLine(this.channel, message);
    try {
      await utils.runCommand(command, [], cmdPath, this.channel);
    } catch {
      message = `${DigitalTwinConstants.dtPrefix} Scaffold code stub failed.`;
      utils.channelShowAndAppendLine(this.channel, message);
      return false;
    }
    message = `${DigitalTwinConstants.dtPrefix} Scaffold code stub completed.`;
    utils.channelShowAndAppendLine(this.channel, message);
    return true;
  }
}
