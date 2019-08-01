import * as path from 'path';
import * as vscode from 'vscode';

import {FileNames, ScaffoldType} from '../../constants';
import {ProjectTemplateType} from '../../Models/Interfaces/ProjectTemplate';
import {IoTContainerizedProject} from '../../Models/IoTContainerizedProject';
import {SimulatorDevice} from '../../Models/SimulatorDevice';
import {TelemetryContext} from '../../telemetry';
import {generateTemplateFile, GetCodeGenTemplateFolderName, getTemplateFilesInfo} from '../../utils';

import {AnsiCCodeGeneratorBase} from './Interfaces/AnsiCCodeGeneratorBase';
import {CodeGenProjectType, DeviceConnectionType} from './Interfaces/CodeGenerator';

export class AnsiCCodeGeneratorImplSimulator extends AnsiCCodeGeneratorBase {
  constructor(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      private telemetryContext: TelemetryContext,
      private provisionType: DeviceConnectionType) {
    super(context, channel);
  }

  async GenerateCode(
      targetPath: string, filePath: string, capabilityModelName: string,
      dcmId: string, interfaceDir: string): Promise<boolean> {
    // Invoke DigitalTwinCodeGen toolset to generate the code
    const retvalue =
        await this.GenerateAnsiCCodeCore(targetPath, filePath, interfaceDir);

    const templateFolderName = await GetCodeGenTemplateFolderName(
        this.context, CodeGenProjectType.Simulator, this.provisionType);
    if (!templateFolderName) {
      throw new Error(`Failed to get template folder name`);
    }

    const templateFolder = this.context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName,
        templateFolderName));
    const templateFilesInfo = await getTemplateFilesInfo(templateFolder);

    const projectName = path.basename(targetPath);

    const projectNamePattern = /{PROJECT_NAME}/g;
    const projectDCMIdPattern = /{DCM_ID}/g;

    for (const fileInfo of templateFilesInfo) {
      if (fileInfo.fileContent === undefined) {
        continue;
      }

      fileInfo.fileContent =
          fileInfo.fileContent.replace(projectNamePattern, projectName)
              .replace(projectDCMIdPattern, dcmId);
    }

    if (retvalue) {
      const iotProject = new IoTContainerizedProject(
          this.context, this.channel, this.telemetryContext);
      const openInNewWindow = true;
      const result = await iotProject.create(
          targetPath, templateFilesInfo, ProjectTemplateType.Basic,
          SimulatorDevice.boardId, openInNewWindow);
      if (!result) {
        throw new Error(`Failed to create iot project`);
      }
    }
    return retvalue;
  }
}
