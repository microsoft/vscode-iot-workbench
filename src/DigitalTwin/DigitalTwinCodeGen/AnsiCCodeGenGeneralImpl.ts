import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {FileNames, ScaffoldType} from '../../constants';
import {TemplateFileInfo} from '../../Models/Interfaces/ProjectTemplate';
import {TelemetryContext} from '../../telemetry';
import {generateTemplateFile} from '../../utils';
import {DigitalTwinFileNames} from '../DigitalTwinConstants';

import {AnsiCCodeGeneratorBase} from './Interfaces/AnsiCCodeGeneratorBase';
import {DeviceConnectionType} from './Interfaces/CodeGenerator';

export class AnsiCCodeGenGeneralImpl extends AnsiCCodeGeneratorBase {
  constructor(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      private telemetryContext: TelemetryContext,
      private provisionType: DeviceConnectionType) {
    super(context, channel);
  }

  async GenerateCode(
      targetPath: string, filePath: string, capabilityModelName: string,
      interfaceDir: string): Promise<boolean> {
    // Invoke DigitalTwinCodeGen toolset to generate the code
    const retvalue =
        await this.GenerateAnsiCCodeCore(targetPath, filePath, interfaceDir);

    let templateFolderName;
    switch (this.provisionType) {
      case DeviceConnectionType.DeviceConnectionString:
        templateFolderName = 'ansic_cmake_connectionstring';
        break;
      case DeviceConnectionType.IoTCSasKey:
        templateFolderName = 'ansic_cmake_iotcsaskey';
        break;
      default:
        throw new Error('Unsupported device provision type.');
    }

    const templateFolder = this.context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName,
        DigitalTwinFileNames.digitalTwinTemplateFolderName,
        templateFolderName));
    const templateFiles = path.join(templateFolder, FileNames.templateFiles);
    const templateFilesJson =
        JSON.parse(fs.readFileSync(templateFiles, 'utf8'));

    const templateFilesInfo: TemplateFileInfo[] = [];
    templateFilesJson.templateFiles.forEach((fileInfo: TemplateFileInfo) => {
      const filePath =
          path.join(templateFolder, fileInfo.sourcePath, fileInfo.fileName);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      templateFilesInfo.push({
        fileName: fileInfo.fileName,
        sourcePath: fileInfo.sourcePath,
        targetPath: fileInfo.targetPath,
        fileContent
      });
    });

    const projectName = path.basename(targetPath);

    const projectNamePattern = /{PROJECT_NAME}/g;

    for (const fileInfo of templateFilesInfo) {
      if (fileInfo.fileContent === undefined) {
        continue;
      }

      fileInfo.fileContent =
          fileInfo.fileContent.replace(projectNamePattern, projectName);
      await generateTemplateFile(targetPath, ScaffoldType.Local, fileInfo);
    }

    if (retvalue) {
      await vscode.commands.executeCommand(
          'vscode.openFolder', vscode.Uri.file(targetPath), true);
    }
    return retvalue;
  }
}
