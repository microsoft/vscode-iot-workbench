import * as fs from 'fs-plus';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import {FileNames, ScaffoldType} from '../../constants';
import {TelemetryContext} from '../../telemetry';
import * as utils from '../../utils';
import {DigitalTwinFileNames} from '../DigitalTwinConstants';

import {AnsiCCodeGeneratorBase} from './Interfaces/AnsiCCodeGeneratorBase';
import {CodeGenProjectType, DeviceConnectionType} from './Interfaces/CodeGenerator';

export class AnsiCCodeGeneratorImplVS extends AnsiCCodeGeneratorBase {
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

    const templateFolderName = await utils.GetCodeGenTemplateFolderName(
        this.context, CodeGenProjectType.VisualStudio, this.provisionType);
    if (!templateFolderName) {
      throw new Error(`Fail to get template folder name`);
    }

    const templateFolder = this.context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName,
        templateFolderName));
    const templateFilesInfo = await utils.getTemplateFilesInfo(templateFolder);

    const projectName = path.basename(targetPath);

    const projectNamePattern = /{PROJECT_NAME}/g;
    const capabilityModelNamePattern = /{CAPABILITYMODELNAME}/g;
    const projectDCMIdPattern = /{DCM_ID}/g;

    for (const fileInfo of templateFilesInfo) {
      if (fileInfo.fileContent === undefined) {
        continue;
      }
      if (fileInfo.fileName === 'iotproject.vcxproj') {
        const utilitiesHPattern = /{UTILITIESFILES_H}/g;
        const utilitiesCPattern = /{UTILITIESFILES_C}/g;
        let includedHeaderFiles = '';
        let includedCFiles = '';
        const utilitiesPath =
            path.join(targetPath, DigitalTwinFileNames.utilitiesFolderName);
        const utilitiesFiles = fs.listSync(utilitiesPath);
        utilitiesFiles.forEach(utilitiesFile => {
          const name = path.basename(utilitiesFile);
          if (name.endsWith('.h')) {
            includedHeaderFiles = includedHeaderFiles +
                `    <ClInclude Include="utilities\\${name}" />\r\n`;
          } else {
            includedCFiles = includedCFiles +
                `    <ClInclude Include="utilities\\${name}" />\r\n`;
          }
        });
        fileInfo.fileContent =
            fileInfo.fileContent.replace(utilitiesHPattern, includedHeaderFiles)
                .replace(utilitiesCPattern, includedCFiles)
                .replace(capabilityModelNamePattern, capabilityModelName);

      } else {
        fileInfo.fileContent =
            fileInfo.fileContent.replace(projectNamePattern, projectName)
                .replace(projectDCMIdPattern, dcmId);
      }
      await utils.generateTemplateFile(
          targetPath, ScaffoldType.Local, fileInfo);
    }

    if (retvalue) {
      try {
        const plat = os.platform();
        if (plat === 'win32') {
          await utils.runCommand(
              'explorer', [targetPath], targetPath, this.channel);
        } else {
          // Open it directly in VS Code
          await vscode.commands.executeCommand(
              'vscode.openFolder', vscode.Uri.file(targetPath), true);
        }
      } catch {
        // Do nothing as if open explorer failed, we will still continue.
      }
    }
    return retvalue;
  }
}
