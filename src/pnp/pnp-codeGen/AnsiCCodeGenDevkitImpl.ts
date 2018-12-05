import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {FileNames} from '../../constants';
import {AZ3166Device} from '../../Models/AZ3166Device';
import {ProjectTemplateType} from '../../Models/Interfaces/ProjectTemplate';
import {IoTProject} from '../../Models/IoTProject';
import {TelemetryContext} from '../../telemetry';
import {generateFoldersForIoTWorkbench} from '../Utilities';

import {AnsiCCodeGeneratorBase} from './Interfaces/AnsiCCodeGeneratorBase';

const constants = {
  deviceDefaultFolderName: 'Device',
  sketchFileName: 'pnp-device.ino'
};

export class AnsiCCodeGenDevkitImpl extends AnsiCCodeGeneratorBase {
  constructor(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      private telemetryContext: TelemetryContext) {
    super(context, channel);
  }

  async GenerateCode(
      targetPath: string, filePath: string, fileCoreName: string,
      connectionString: string): Promise<boolean> {
    generateFoldersForIoTWorkbench(
        targetPath, constants.deviceDefaultFolderName, fileCoreName);

    // Invoke PnP toolset to generate the code
    const libPath = path.join(
        targetPath, constants.deviceDefaultFolderName, 'src', fileCoreName);
    const codeGenerateResult =
        await this.GenerateAnsiCCodeCore(libPath, filePath, connectionString);
    if (!codeGenerateResult) {
      vscode.window.showErrorMessage(
          'Unable to generate code, please check output window for detail.');
      return false;
    }

    // TODO: update the telemetry
    const project: IoTProject =
        new IoTProject(this.context, this.channel, this.telemetryContext);

    const originPath = this.context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, AZ3166Device.boardId,
        constants.sketchFileName));
    const originalContent = fs.readFileSync(originPath, 'utf8');

    const pathPattern = /{PATHNAME}/g;
    const replaceStr = originalContent.replace(pathPattern, fileCoreName);

    await project.create(
        targetPath, replaceStr, ProjectTemplateType.Basic, AZ3166Device.boardId,
        true);
    return true;
  }
}