import * as fs from 'fs-plus';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import {FileNames} from '../../constants';
import {TelemetryContext} from '../../telemetry';
import * as utils from '../../utils';

import {AnsiCCodeGeneratorBase} from './Interfaces/AnsiCCodeGeneratorBase';
import {DeviceConnectionType} from './Interfaces/CodeGenerator';

const ansiConstants = {
  languageName: 'ansic',
  digitalTwin: 'digitaltwin',
  projectType: 'visualstudio',
  utilitiesFolderName: 'utilities'
};

const templateFileNames =
    ['Readme.md', 'main.c', 'CMakeLists.txt', 'iotproject.vcxproj'];

export class AnsiCCodeGenVSImpl extends AnsiCCodeGeneratorBase {
  constructor(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      private telemetryContext: TelemetryContext,
      private provisionType: DeviceConnectionType) {
    super(context, channel);
  }

  async GenerateCode(
      targetPath: string, filePath: string, capabilityModelName: string,
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
        ansiConstants.languageName, ansiConstants.projectType, folderName));

    const projectName = path.basename(targetPath);

    const projectNamePattern = /{PROJECT_NAME}/g;
    const capabilityModelNamePattern = /{CAPABILITYMODELNAME}/g;
    let replaceStr = '';

    templateFileNames.forEach(fileName => {
      const source = path.join(resouceFolder, fileName);
      const target = path.join(targetPath, fileName);
      const fileContent = fs.readFileSync(source, 'utf8');
      if (fileName === 'iotproject.vcxproj') {
        const utilitiesHPattern = /{UTILITIESFILES_H}/g;
        const utilitiesCPattern = /{UTILITIESFILES_C}/g;
        let includedHeaderFiles = '';
        let includedCFiles = '';
        const utilitiesPath =
            path.join(targetPath, ansiConstants.utilitiesFolderName);
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
        replaceStr =
            fileContent.replace(utilitiesHPattern, includedHeaderFiles)
                .replace(utilitiesCPattern, includedCFiles)
                .replace(capabilityModelNamePattern, capabilityModelName);
      } else {
        replaceStr = fileContent.replace(projectNamePattern, projectName);
      }
      fs.writeFileSync(target, replaceStr);
    });

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
