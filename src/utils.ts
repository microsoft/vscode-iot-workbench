// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as cp from 'child_process';
import * as fs from 'fs-plus';
import * as path from 'path';
import {setTimeout} from 'timers';
import * as vscode from 'vscode';
import * as WinReg from 'winreg';

import {AzureFunctionsLanguage, FileNames, GlobalConstants, OperationType, ScaffoldType, TemplateTag} from './constants';
import {DialogResponses} from './DialogResponses';
import {CodeGenProjectType, DeviceConnectionType} from './DigitalTwin/DigitalTwinCodeGen/Interfaces/CodeGenerator';
import {FileUtility} from './FileUtility';
import {ProjectHostType} from './Models/Interfaces/ProjectHostType';
import {ProjectTemplate, TemplateFileInfo} from './Models/Interfaces/ProjectTemplate';
import {Platform} from './Models/Interfaces/ProjectTemplate';
import {RemoteExtension} from './Models/RemoteExtension';
import {TelemetryContext} from './telemetry';

const impor = require('impor')(__dirname);
import {IoTWorkbenchProjectBase} from './Models/IoTWorkbenchProjectBase';
const ioTWorkspaceProjectModule = impor('./Models/IoTWorkspaceProject') as
    typeof import('./Models/IoTWorkspaceProject');
const ioTContainerizedProjectModule =
    impor('./Models/IoTContainerizedProject') as
    typeof import('./Models/IoTContainerizedProject');

export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getRegistryValues(
    hive: string, key: string, name: string): Promise<string> {
  return new Promise(
      async (
          resolve: (value: string) => void, reject: (value: Error) => void) => {
        try {
          const regKey = new WinReg({hive, key});

          regKey.valueExists(name, (e, exists) => {
            if (e) {
              return reject(e);
            }
            if (exists) {
              regKey.get(name, (err, result) => {
                if (!err) {
                  return resolve(result ? result.value : '');
                } else {
                  return reject(err);
                }
              });
            } else {
              return resolve('');
            }
          });
        } catch (ex) {
          return reject(ex);
        }
      });
}

export function directoryExistsSync(dirPath: string): boolean {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch (e) {
    return false;
  }
}

export function mkdirRecursivelySync(dirPath: string): void {
  if (directoryExistsSync(dirPath)) {
    return;
  }
  const dirname = path.dirname(dirPath);
  if (path.normalize(dirname) === path.normalize(dirPath)) {
    fs.mkdirSync(dirPath);
  } else if (directoryExistsSync(dirname)) {
    fs.mkdirSync(dirPath);
  } else {
    mkdirRecursivelySync(dirname);
    fs.mkdirSync(dirPath);
  }
}

export function fileExistsSync(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch (e) {
    return false;
  }
}

export function getScriptTemplateNameFromLanguage(language: string): string|
    undefined {
  switch (language) {
    case AzureFunctionsLanguage.CSharpScript:
      return 'IoTHubTrigger-CSharp';
    case AzureFunctionsLanguage.JavaScript:
      return 'IoTHubTrigger-JavaScript';
    case AzureFunctionsLanguage.CSharpLibrary:
      return 'Azure.Function.CSharp.IotHubTrigger.2.x';
    default:
      return undefined;
  }
}

/**
 * Provides additional options for QuickPickItems used in Azure Extensions
 */
export interface FolderQuickPickItem<T = undefined> extends
    vscode.QuickPickItem {
  data: T;
}

export async function selectWorkspaceFolder(
    placeHolder: string,
    getSubPath?: (f: vscode.WorkspaceFolder) =>
        string | undefined): Promise<string> {
  return await selectWorkspaceItem(
      placeHolder, {
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: vscode.workspace.workspaceFolders &&
                vscode.workspace.workspaceFolders.length > 0 ?
            vscode.workspace.workspaceFolders[0].uri :
            undefined,
        openLabel: 'Select'
      },
      getSubPath);
}

export async function showOpenDialog(options: vscode.OpenDialogOptions):
    Promise<vscode.Uri[]> {
  const result: vscode.Uri[]|undefined =
      await vscode.window.showOpenDialog(options);

  if (result === undefined) {
    throw new Error('User cancelled the operation.');
  } else {
    return result;
  }
}

export async function selectWorkspaceItem(
    placeHolder: string, options: vscode.OpenDialogOptions,
    getSubPath?: (f: vscode.WorkspaceFolder) =>
        string | undefined): Promise<string> {
  let folder: FolderQuickPickItem<string|undefined>|undefined;
  let folderPicks: Array<FolderQuickPickItem<string|undefined>> = [];
  if (vscode.workspace.workspaceFolders) {
    folderPicks =
        vscode.workspace.workspaceFolders.map((f: vscode.WorkspaceFolder) => {
          let subpath: string|undefined;
          if (getSubPath) {
            subpath = getSubPath(f);
          }

          const fsPath: string =
              subpath ? path.join(f.uri.fsPath, subpath) : f.uri.fsPath;
          return {
            label: path.basename(fsPath),
            description: fsPath,
            data: fsPath
          };
        });
  }
  folderPicks.push({label: 'Browse...', description: '', data: undefined});
  folder = await vscode.window.showQuickPick(
      folderPicks, {placeHolder, ignoreFocusOut: true});
  if (folder === undefined) {
    throw new Error('User cancelled the operation.');
  }

  return folder && folder.data ? folder.data :
                                 (await showOpenDialog(options))[0].fsPath;
}

export function runCommand(
    command: string, args: string[], workingDir: string,
    outputChannel: vscode.OutputChannel): Thenable<object> {
  return new Promise((resolve, reject) => {
    const stdout = '';
    const stderr = '';
    const process = cp.spawn(command, args, {cwd: workingDir, shell: true});
    process.stdout.on('data', (data: string) => {
      console.log(data);
      outputChannel.appendLine(data);
    });
    process.stderr.on('data', (data: string) => {
      console.log(data);
      outputChannel.appendLine(data);
    });
    process.on('error', error => reject({error, stderr, stdout}));
    process.on('close', status => {
      if (status === 0) {
        resolve({status, stdout, stderr});
      } else {
        reject({status, stdout, stderr});
      }
    });
  });
}

export async function askAndNewProject(telemetryContext: TelemetryContext) {
  const message =
      'An IoT project is needed to process the operation, do you want to create an IoT project?';
  const result:|vscode.MessageItem|undefined =
      await vscode.window.showInformationMessage(
          message, DialogResponses.yes, DialogResponses.no);

  if (result === DialogResponses.yes) {
    telemetryContext.properties.errorMessage =
        'Operation failed and user creates new project';
    await vscode.commands.executeCommand('iotworkbench.initializeProject');
  } else {
    telemetryContext.properties.errorMessage = 'Operation failed.';
  }
}

export async function askAndOpenProject(
    rootPath: string, workspaceFile: string,
    telemetryContext: TelemetryContext) {
  const message =
      `Operation failed because the IoT project is not opened. Current folder contains an IoT project '${
          workspaceFile}', do you want to open it?`;
  const result:|vscode.MessageItem|undefined =
      await vscode.window.showInformationMessage(
          message, DialogResponses.yes, DialogResponses.no);

  if (result === DialogResponses.yes) {
    telemetryContext.properties.errorMessage =
        'Operation failed and user opens project from folder.';
    const workspaceFilePath = path.join(rootPath, workspaceFile);
    await vscode.commands.executeCommand(
        'iotcube.openLocally', workspaceFilePath, false);
  } else {
    telemetryContext.properties.errorMessage = 'Operation failed.';
  }
}

export async function askAndOpenInRemote(
    operation: OperationType, channel: vscode.OutputChannel,
    telemetryContext: TelemetryContext): Promise<boolean> {
  const message = `${
      operation} can only be executed in remote container. Do you want to reopen the IoT project in container?`;
  const result:|vscode.MessageItem|undefined =
      await vscode.window.showInformationMessage(
          message, DialogResponses.yes, DialogResponses.no);

  if (result === DialogResponses.yes) {
    telemetryContext.properties.errorMessage =
        `${operation} Operation failed and user opens project in container.`;
    const res = await RemoteExtension.checkRemoteExtension(channel);
    if (!res) {
      telemetryContext.properties.errorMessage =
          `${operation} Operation failed on installing Remote Extension.`;
      return false;
    }
    await vscode.commands.executeCommand('openindocker.reopenInContainer');
  } else {
    const message = `${operation} can only be executed in remote container.`;
    channelShowAndAppendLine(channel, message);
    telemetryContext.properties.errorMessage = 'Operation failed.';
  }

  return false;
}
const noDeviceSurveyUrl = 'https://www.surveymonkey.com/r/C7NY7KJ';

export async function takeNoDeviceSurvey(telemetryContext: TelemetryContext) {
  const message =
      'Could you help to take a quick survey about what IoT development kit(s) you want Azure IoT Device Workbench to support?';
  const result:|vscode.MessageItem|undefined =
      await vscode.window.showWarningMessage(
          message, DialogResponses.yes, DialogResponses.cancel);
  if (result === DialogResponses.yes) {
    // Open the survey page
    telemetryContext.properties.message = 'User takes no-device survey.';
    telemetryContext.properties.result = 'Succeeded';

    const extension =
        vscode.extensions.getExtension(GlobalConstants.extensionId);
    if (!extension) {
      return;
    }
    const extensionVersion = extension.packageJSON.version || 'unknown';
    await vscode.commands.executeCommand(
        'vscode.open',
        vscode.Uri.parse(
            `${noDeviceSurveyUrl}?o=${encodeURIComponent(process.platform)}&v=${
                encodeURIComponent(extensionVersion)}`));
  }
  return;
}

export function generateInterfaceFileNameFromUrnId(
    urnId: string, targetPath: string) {
  const suffix = '.interface.json';
  const names: string[] = urnId.split(':');
  // at least the path should contain urn, namespace, name & version
  if (names.length < 4) {
    throw new Error(`The id of the file is not valid. id: ${urnId}`);
  }

  const displayName = names.join('_');
  let counter = 0;
  let candidateName = displayName + suffix;
  while (true) {
    const filePath = path.join(targetPath, candidateName);
    if (!fileExistsSync(filePath)) {
      break;
    }
    counter++;
    candidateName = `${displayName}_${counter}${suffix}`;
  }
  return candidateName;
}
export class InternalConfig {
  static isInternal: boolean = InternalConfig.isInternalUser();

  private static isInternalUser(): boolean {
    const userDomain = process.env.USERDNSDOMAIN ?
        process.env.USERDNSDOMAIN.toLowerCase() :
        '';
    return userDomain.endsWith('microsoft.com');
  }
}

export async function getTemplateFilesInfo(templateFolder: string):
    Promise<TemplateFileInfo[]> {
  const templateFilesInfo: TemplateFileInfo[] = [];

  const templateFiles = path.join(templateFolder, FileNames.templateFiles);
  if (!(await FileUtility.fileExists(ScaffoldType.Local, templateFiles))) {
    throw new Error(`Template file ${templateFiles} does not exist.`);
  }

  const templateFilesJson = JSON.parse(fs.readFileSync(templateFiles, 'utf8'));

  templateFilesJson.templateFiles.forEach((fileInfo: TemplateFileInfo) => {
    const filePath =
        path.join(templateFolder, fileInfo.sourcePath, fileInfo.fileName);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    templateFilesInfo.push({
      fileName: fileInfo.fileName,
      sourcePath: fileInfo.sourcePath,
      targetPath: fileInfo.targetPath,
      overwrite: typeof fileInfo.overwrite !== 'undefined' ?
          fileInfo.overwrite :
          true,  // if it is not defined, we will overwrite the existing file.
      fileContent
    });
  });

  return templateFilesInfo;
}

export async function getCodeGenTemplateFolderName(
    context: vscode.ExtensionContext, codeGenProjectType: CodeGenProjectType,
    connectionType: DeviceConnectionType): Promise<string|undefined> {
  const templateFilePath = context.asAbsolutePath(path.join(
      FileNames.resourcesFolderName, FileNames.templatesFolderName,
      FileNames.templateFileName));
  if (!(await FileUtility.fileExists(ScaffoldType.Local, templateFilePath))) {
    throw new Error(`Template file ${templateFilePath} does not exist.`);
  }

  const templateFile =
      (await FileUtility.readFile(
          ScaffoldType.Local, templateFilePath, 'utf8')) as string;
  const templateFileJson = JSON.parse(templateFile);

  const result =
      templateFileJson.templates.filter((template: ProjectTemplate) => {
        return (
            template.tag === TemplateTag.Digitaltwin &&
            template.type === codeGenProjectType &&
            template.connectionType === connectionType);
      });

  if (result && result.length > 0) {
    return result[0].path;
  } else {
    return;
  }
}

export async function generateTemplateFile(
    root: string, type: ScaffoldType,
    fileInfo: TemplateFileInfo): Promise<boolean> {
  const targetFolderPath = path.join(root, fileInfo.targetPath);
  if (!(await FileUtility.directoryExists(type, targetFolderPath))) {
    await FileUtility.mkdirRecursively(type, targetFolderPath);
  }

  const targetFilePath = path.join(targetFolderPath, fileInfo.fileName);
  if (fileInfo.fileContent) {
    try {
      const fileExist = await FileUtility.fileExists(type, targetFilePath);
      if (fileInfo.overwrite || !fileExist) {
        await FileUtility.writeFile(type, targetFilePath, fileInfo.fileContent);
      }
    } catch (error) {
      throw new Error(`Failed to create sketch file ${fileInfo.fileName}: ${
          error.message}`);
    }
  }
  return true;
}

/**
 * If current folder is an IoT Workspace Project but not open correctly, ask
 * and open the IoT Workspace Project.
 */
export async function handleIoTWorkspaceProjectFolder(
    telemetryContext: TelemetryContext) {
  if (!(vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length > 0) ||
      !vscode.workspace.workspaceFolders[0]) {
    return;
  }

  const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const workbenchFileName =
      path.join(rootPath, 'Device', FileNames.iotworkbenchprojectFileName);

  const workspaceFiles = fs.readdirSync(rootPath).filter(
      file => path.extname(file).endsWith(FileNames.workspaceExtensionName));

  if (fs.existsSync(workbenchFileName) && workspaceFiles && workspaceFiles[0]) {
    await askAndOpenProject(rootPath, workspaceFiles[0], telemetryContext);
    return;
  }

  await askAndNewProject(telemetryContext);
  return;
}

export function channelShowAndAppend(
    channel: vscode.OutputChannel, message: string) {
  channel.show();
  channel.append(message);
}

export function channelShowAndAppendLine(
    channel: vscode.OutputChannel, message: string) {
  channel.show();
  channel.appendLine(message);
}

export async function constructAndLoadIoTProject(
    context: vscode.ExtensionContext, channel: vscode.OutputChannel,
    telemetryContext: TelemetryContext, askNewProject = true) {
  let projectHostType;
  if (vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0) {
    const projectFileRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    projectHostType = await IoTWorkbenchProjectBase.getProjectType(
        ScaffoldType.Workspace, projectFileRootPath);
    let iotProject;
    if (projectHostType === ProjectHostType.Container) {
      iotProject = new ioTContainerizedProjectModule.IoTContainerizedProject(
          context, channel, telemetryContext);
    } else if (projectHostType === ProjectHostType.Workspace) {
      iotProject = new ioTWorkspaceProjectModule.IoTWorkspaceProject(
          context, channel, telemetryContext);
    }

    if (!askNewProject) {
      return;
    }

    if (iotProject === undefined) {
      await handleIoTWorkspaceProjectFolder(telemetryContext);
      return;
    }

    const result = await iotProject.load();
    if (!result) {
      await askAndNewProject(telemetryContext);
      return;
    }
    return iotProject;
  }
  return;
}

// tslint:disable-next-line: no-any
export function getEnumKeyByEnumValue(myEnum: any, enumValue: any) {
  // tslint:disable-next-line: no-any
  const keys = Object.keys(myEnum).filter(x => myEnum[x] === enumValue);
  const key = keys.length > 0 ? keys[0] : null;
  if (key === null) {
    return undefined;
  }
  return myEnum[key];
}

export async function selectPlatform(
    type: ScaffoldType,
    context: vscode.ExtensionContext): Promise<vscode.QuickPickItem|undefined> {
  const platformListPath = context.asAbsolutePath(path.join(
      FileNames.resourcesFolderName, FileNames.templatesFolderName,
      FileNames.platformListFileName));
  const platformListJsonString =
      await FileUtility.readFile(type, platformListPath, 'utf8') as string;
  const platformListJson = JSON.parse(platformListJsonString);

  if (!platformListJson) {
    throw new Error('Fail to load platform list.');
  }

  const platformList: vscode.QuickPickItem[] = [];

  platformListJson.platforms.forEach((platform: Platform) => {
    platformList.push(
        {label: platform.name, description: platform.description});
  });

  const platformSelection = await vscode.window.showQuickPick(platformList, {
    ignoreFocusOut: true,
    matchOnDescription: true,
    matchOnDetail: true,
    placeHolder: 'Select a platform',
  });

  return platformSelection;
}