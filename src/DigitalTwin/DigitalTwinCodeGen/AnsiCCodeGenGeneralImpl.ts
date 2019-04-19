import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {FileNames} from '../../constants';
import {TelemetryContext} from '../../telemetry';

import {AnsiCCodeGeneratorBase} from './Interfaces/AnsiCCodeGeneratorBase';
import {DeviceConnectionType} from './Interfaces/CodeGenerator';

const ansiConstants = {
  languageName: 'ansi',
  digitalTwin: 'digitaltwin'
};

const templateFileNames = ['Readme.md', 'main.c.sample', 'CMakeLists.txt'];

export class AnsiCCodeGenGeneralImpl extends AnsiCCodeGeneratorBase {
  constructor(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      private telemetryContext: TelemetryContext,
      private provisionType: DeviceConnectionType) {
    super(context, channel);
  }

  async GenerateCode(
      targetPath: string, filePath: string, fileCoreName: string,
      connectionString: string): Promise<boolean> {
    // Invoke DigitalTwinCodeGen toolset to generate the code
    const retvalue = await this.GenerateAnsiCCodeCore(
        targetPath, filePath, connectionString);

    let folderName;
    switch (this.provisionType) {
      case DeviceConnectionType.DeviceConnectionString:
        folderName = 'connectionstring';
        break;
      case DeviceConnectionType.IoTCSasKey:
        folderName = 'iotcsaskey';
        break;
      default:
        throw new Error('Unsupported device provision type.');
    }

    const resouceFolder = this.context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, ansiConstants.digitalTwin,
        ansiConstants.languageName, folderName));

    const projectName = path.basename(targetPath);

    const projectNamePattern = /{PROJECT_NAME}/g;

    templateFileNames.forEach(fileName => {
      const source = path.join(resouceFolder, fileName);
      const target = path.join(targetPath, fileName);
      const fileContent = fs.readFileSync(source, 'utf8');

      const replaceStr = fileContent.replace(projectNamePattern, projectName);
      fs.writeFileSync(target, replaceStr);
    });

    if (retvalue) {
      await vscode.commands.executeCommand(
          'vscode.openFolder', vscode.Uri.file(targetPath), true);
    }
    return retvalue;
  }
}
