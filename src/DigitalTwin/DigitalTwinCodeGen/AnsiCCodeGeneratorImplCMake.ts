import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {FileNames, ScaffoldType} from '../../constants';
import {TelemetryContext} from '../../telemetry';
import {generateTemplateFile, GetCodeGenTemplateFolderName, getTemplateFilesInfo} from '../../utils';
import {NewLine} from '../Tokenizer';

import {AnsiCCodeGeneratorBase} from './Interfaces/AnsiCCodeGeneratorBase';
import {CodeGenProjectType, DeviceConnectionType} from './Interfaces/CodeGenerator';

export class AnsiCCodeGeneratorImplCMake extends AnsiCCodeGeneratorBase {
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
        this.context, CodeGenProjectType.CMake, this.provisionType);
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
    const cmakeHeaderFilesPattern = /{H_FILE_LIST}/g;
    const cmakeCFilesPattern = /{C_FILE_LIST}/g;

    for (const fileInfo of templateFilesInfo) {
      if (fileInfo.fileContent === undefined) {
        continue;
      }

      if (fileInfo.fileName === 'CMakeLists.txt') {
        const generatedFiles = fs.listTreeSync(targetPath);

        // Retrieve and normalize generated files that will be included in
        // CMakeLists.txt
        const includedHeaderFiles =
            this.getIncludedFileListString(generatedFiles, targetPath, '.h');
        const includedCFiles =
            this.getIncludedFileListString(generatedFiles, targetPath, '.c');

        fileInfo.fileContent =
            fileInfo.fileContent
                .replace(cmakeHeaderFilesPattern, includedHeaderFiles)
                .replace(cmakeCFilesPattern, includedCFiles);
      }

      fileInfo.fileContent =
          fileInfo.fileContent.replace(projectNamePattern, projectName)
              .replace(projectDCMIdPattern, dcmId);

      await generateTemplateFile(targetPath, ScaffoldType.Local, fileInfo);
    }

    if (retvalue) {
      await vscode.commands.executeCommand(
          'vscode.openFolder', vscode.Uri.file(targetPath), true);
    }
    return retvalue;
  }

  getIncludedFileListString(
      generatedFiles: string[], rootDir: string,
      fileExtension: string): string {
    let fileListStr = '';

    if (generatedFiles !== null && generatedFiles.length > 0) {
      const includeFiles =
          generatedFiles
              .filter(
                  file => path.extname(file) === fileExtension &&
                      !file.endsWith('main.c'))
              .map(filePath => path.relative(rootDir, filePath))
              .map(filePath => './' + filePath.replace(path.sep, '/'));

      fileListStr = includeFiles.join(`${NewLine}    `);
    }

    return fileListStr;
  }
}
