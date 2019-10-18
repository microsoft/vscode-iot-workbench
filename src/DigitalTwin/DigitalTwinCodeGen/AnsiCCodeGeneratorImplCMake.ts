import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {FileNames, ScaffoldType} from '../../constants';
import {TemplateFileInfo} from '../../Models/Interfaces/ProjectTemplate';
import {generateTemplateFile, getCodeGenTemplateFolderName, getTemplateFilesInfo} from '../../utils';
import {DigitalTwinConstants} from '../DigitalTwinConstants';
import {NewLine} from '../Tokenizer';

import {AnsiCCodeGeneratorBase} from './Interfaces/AnsiCCodeGeneratorBase';
import {CodeGenProjectType, DeviceConnectionType, DeviceSdkReferenceType} from './Interfaces/CodeGenerator';

export class AnsiCCodeGeneratorImplCMake extends AnsiCCodeGeneratorBase {
  private projectType: CodeGenProjectType;
  private sdkReferenceType: DeviceSdkReferenceType;
  private connectionType: DeviceConnectionType;

  constructor(
      projectType: CodeGenProjectType,
      sdkReferenceType: DeviceSdkReferenceType,
      connectionType: DeviceConnectionType,
      context: vscode.ExtensionContext,
      channel: vscode.OutputChannel,
  ) {
    super(context, channel);

    this.connectionType = connectionType;
    this.projectType = projectType;
    this.sdkReferenceType = sdkReferenceType;
  }

  async generateCode(
      targetPath: string, filePath: string, capabilityModelName: string,
      dcmId: string, interfaceDir: string): Promise<boolean> {
    // Invoke DigitalTwinCodeGen toolset to generate the code
    const retvalue =
        await this.generateAnsiCCodeCore(targetPath, filePath, interfaceDir);

    const templateFolderName = await getCodeGenTemplateFolderName(
        this.context, this.projectType, this.connectionType);
    if (!templateFolderName) {
      throw new Error(`Failed to get template folder name`);
    }

    const templateFolder = this.context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName,
        templateFolderName));

    const projectName = path.basename(targetPath);

    const projectNamePattern = /{PROJECT_NAME}/g;
    const projectDCMIdPattern = /{DCM_ID}/g;
    const cmakeHeaderFilesPattern = /{H_FILE_LIST}/g;
    const cmakeCFilesPattern = /{C_FILE_LIST}/g;

    const allTemplateFiles: TemplateFileInfo[] =
        await getTemplateFilesInfo(templateFolder);
    const cmakeListsFileName =
        this.getCmakeListsFileName(this.projectType, this.sdkReferenceType);
    const requiredTemplateFiles = allTemplateFiles.filter(
        fileInfo => !fileInfo.fileName.startsWith('CMakeLists') ||
            fileInfo.fileName === cmakeListsFileName);

    for (const fileInfo of requiredTemplateFiles) {
      if (!fileInfo.fileContent) {
        continue;
      }

      if (fileInfo.fileName === cmakeListsFileName) {
        const generatedFiles = fs.listTreeSync(targetPath);
        // Rename to standard CMakeLists.txt file name
        fileInfo.fileName = DigitalTwinConstants.cmakeListsFileName;

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

  private getCmakeListsFileName(
      projectType: CodeGenProjectType,
      deviceSdkReferenceType: DeviceSdkReferenceType): string {
    const projectTypeSegments: string[] = projectType.toString().split(
        DigitalTwinConstants.codeGenProjectTypeSeperator);
    if (projectTypeSegments.length !== 2) {
      throw new Error(`Invalid project type: ${projectType.toString()}`);
    }

    const platform: string = projectTypeSegments[1];
    const cmakeListsFileName =
        `CMakeLists-${platform}-${deviceSdkReferenceType.toString()}.txt`;

    return cmakeListsFileName;
  }

  private getIncludedFileListString(
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
