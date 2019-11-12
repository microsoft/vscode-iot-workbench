import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import * as utils from '../../../utils';
import {DigitalTwinConstants} from '../../DigitalTwinConstants';

import {CodeGenerator, CodeGenExecutionItem} from './CodeGenerator';

export class AnsiCCodeGenerator implements CodeGenerator {
  constructor(
      protected context: vscode.ExtensionContext,
      protected channel: vscode.OutputChannel) {}

  async generateCode(codegenInfo: CodeGenExecutionItem): Promise<boolean> {
    // Invoke PnP toolset to generate the code
    const codegenSucceeded = await this.generateAnsiCCodeCore(codegenInfo);

    if (codegenSucceeded) {
      await vscode.commands.executeCommand(
          'vscode.openFolder', vscode.Uri.file(codegenInfo.outputDirectory),
          true);
      return true;
    } else {
      vscode.window.showErrorMessage(
          'Unable to generate code, please check output window for detail.');
      return false;
    }
  }

  async generateAnsiCCodeCore(codegenInfo: CodeGenExecutionItem):
      Promise<boolean> {
    // Invoke DigitalTwinCodeGen toolset to generate the code
    const projectTypeValue = codegenInfo.codeGenProjectType.toString();
    const connectionTypeValue = codegenInfo.deviceConnectionType.toString();
    const sdkReferenceTypeValue = codegenInfo.deviceSdkReferenceType.toString();
    const dcmFilePath = codegenInfo.capabilityModelFilePath;
    const interfaceDir = codegenInfo.interfaceDirecoty;
    const outputDir = codegenInfo.outputDirectory;
    const projectName = codegenInfo.projectName;

    // Get platform-specific CodeGen CLI name.
    const platform = os.platform();
    const homeDir = os.homedir();
    const cmdPath = path.join(homeDir, DigitalTwinConstants.codeGenCliFolder);
    let codeGenCommand = '';
    if (platform === 'win32') {
      codeGenCommand = `${DigitalTwinConstants.codeGenCliApp}.exe`;
    } else {
      codeGenCommand = `./${DigitalTwinConstants.codeGenCliApp}`;
    }

    const command = `${codeGenCommand} generate -d "${dcmFilePath}" -i "${
        interfaceDir}" -p "${projectTypeValue}" -c "${
        connectionTypeValue}" -r "${sdkReferenceTypeValue}" -l ansic -o "${
        outputDir}" -n "${projectName}"`;

    let message = `${DigitalTwinConstants.dtPrefix} generate PnP device code.`;
    utils.channelShowAndAppendLine(this.channel, message);
    try {
      await utils.runCommand(command, [], cmdPath, this.channel);
    } catch {
      message =
          `${DigitalTwinConstants.dtPrefix} generate PnP device codefailed.`;
      utils.channelShowAndAppendLine(this.channel, message);
      return false;
    }

    message =
        `${DigitalTwinConstants.dtPrefix} generate PnP device code completed.`;
    utils.channelShowAndAppendLine(this.channel, message);
    return true;
  }
}
