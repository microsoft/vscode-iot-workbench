import * as path from 'path';
import * as vscode from 'vscode';

import {FileNames, ScaffoldType} from '../../constants';
import {FileUtility} from '../../FileUtility';
import {AZ3166Device} from '../../Models/AZ3166Device';
import {ProjectTemplateType} from '../../Models/Interfaces/ProjectTemplate';
import {IoTWorkspaceProject} from '../../Models/IoTWorkspaceProject';
import {TelemetryContext} from '../../telemetry';
import * as utils from '../../utils';

import {AnsiCCodeGeneratorBase} from './Interfaces/AnsiCCodeGeneratorBase';
import {DeviceConnectionType} from './Interfaces/CodeGenerator';

const constants = {
  deviceDefaultFolderName: 'Device',
  srcFolderName: 'src'
};

export class AnsiCCodeGenDevkitImpl extends AnsiCCodeGeneratorBase {
  constructor(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      private telemetryContext: TelemetryContext,
      private connectionType: DeviceConnectionType) {
    super(context, channel);
  }

  async GenerateCode(
      targetPath: string, filePath: string, capabilityModelName: string,
      interfaceDir: string): Promise<boolean> {
    // Invoke PnP toolset to generate the code
    const libPath = path.join(
        targetPath, constants.deviceDefaultFolderName, constants.srcFolderName,
        capabilityModelName);
    await FileUtility.mkdirRecursively(ScaffoldType.Local, libPath);

    const codeGenerateResult =
        await this.GenerateAnsiCCodeCore(libPath, filePath, interfaceDir);
    if (!codeGenerateResult) {
      vscode.window.showErrorMessage(
          'Unable to generate code, please check output window for detail.');
      return false;
    }

    // TODO: update the telemetry
    const project: IoTWorkspaceProject = new IoTWorkspaceProject(
        this.context, this.channel, this.telemetryContext);

    // Generate device code for IoT DevKit according to the provision option.
    let templateFolderName;
    switch (this.connectionType) {
      case DeviceConnectionType.DeviceConnectionString:
        templateFolderName = 'ansic_devkit_connectionstring';
        break;
      case DeviceConnectionType.IoTCSasKey:
        templateFolderName = 'ansic_devkit_iotcsaskey';
        break;
      default:
        throw new Error('Unsupported device provision type.');
    }

    const templateFolder = this.context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName,
        templateFolderName));
    const templateFilesInfo = utils.getTemplateFilesInfo(templateFolder);

    for (const fileInfo of templateFilesInfo) {
      if (fileInfo.fileContent === undefined) {
        continue;
      }
      if (fileInfo.fileName.endsWith('.ino')) {
        const pathPattern = /{PATHNAME}/g;
        fileInfo.fileContent =
            fileInfo.fileContent.replace(pathPattern, capabilityModelName);
      }
    }

    await project.create(
        targetPath, templateFilesInfo, ProjectTemplateType.Basic,
        AZ3166Device.boardId, true);
    return true;
  }
}
