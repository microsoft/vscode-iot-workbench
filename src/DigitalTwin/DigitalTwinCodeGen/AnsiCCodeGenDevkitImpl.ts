import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {FileNames} from '../../constants';
import {AZ3166Device} from '../../Models/AZ3166Device';
import {ProjectTemplateType, TemplateFileInfo} from '../../Models/Interfaces/ProjectTemplate';

import {IoTWorkspaceProject} from '../../Models/IoTWorkspaceProject';
import {TelemetryContext} from '../../telemetry';
import {generateFoldersForIoTWorkbench} from '../Utilities';

import {AnsiCCodeGeneratorBase} from './Interfaces/AnsiCCodeGeneratorBase';
import {DeviceConnectionType} from './Interfaces/CodeGenerator';

const constants = {
  deviceDefaultFolderName: 'Device',
  deviceConnectionStringSketchFileName: 'dt_device_connectionstring.ino',
  deviceIotcSasKeySketchFileName: 'dt_device_iotcsaskey.ino'
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
    generateFoldersForIoTWorkbench(
        targetPath, constants.deviceDefaultFolderName, capabilityModelName);

    // Invoke PnP toolset to generate the code
    const libPath = path.join(
        targetPath, constants.deviceDefaultFolderName, 'src',
        capabilityModelName);
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
    let sketchFileName;
    switch (this.connectionType) {
      case DeviceConnectionType.DeviceConnectionString:
        sketchFileName = constants.deviceConnectionStringSketchFileName;
        break;
      case DeviceConnectionType.IoTCSasKey:
        sketchFileName = constants.deviceIotcSasKeySketchFileName;
        break;
      default:
        throw new Error('Unsupported device provision type.');
    }

    const originPath = this.context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, AZ3166Device.boardId, sketchFileName));

    const originalContent = fs.readFileSync(originPath, 'utf8');
    const pathPattern = /{PATHNAME}/g;
    const replaceStr =
        originalContent.replace(pathPattern, capabilityModelName);

    const templateFilesInfo: TemplateFileInfo[] = [];
    templateFilesInfo.push({
      fileName: sketchFileName,
      sourcePath: '',
      targetPath: '.',
      fileContent: replaceStr
    });

    await project.create(
        targetPath, templateFilesInfo, ProjectTemplateType.Basic,
        AZ3166Device.boardId, true);
    return true;
  }
}