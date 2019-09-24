// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as cp from 'child_process';
import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';
import {MessageItem} from 'vscode';
import * as WinReg from 'winreg';

import {CancelOperationError} from './CancelOperationError';
import {AzureFunctionsLanguage, FileNames, GlobalConstants, OperationType, PlatformType, ScaffoldType, TemplateTag} from './constants';
import {DialogResponses} from './DialogResponses';
import {CodeGenProjectType, DeviceConnectionType} from './DigitalTwin/DigitalTwinCodeGen/Interfaces/CodeGenerator';
import {FileUtility} from './FileUtility';
import {ProjectHostType} from './Models/Interfaces/ProjectHostType';
import {ProjectTemplate, TemplateFileInfo} from './Models/Interfaces/ProjectTemplate';
import {Platform} from './Models/Interfaces/ProjectTemplate';
import {RemoteExtension} from './Models/RemoteExtension';
import {ProjectEnvironmentConfiger} from './ProjectEnvironmentConfiger';
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

/**
 * Pop out information window suggesting user to configure project environment
 * first.
 * @returns true - configure successfully; false - fail to configure or cancel
 * configuration.
 */
export async function askToConfigureEnvironment(
    context: vscode.ExtensionContext, channel: vscode.OutputChannel,
    telemetryContext: TelemetryContext, platform: PlatformType,
    rootPath: string, scaffoldType: ScaffoldType, operation: OperationType) {
  const message = `${
      operation} operation failed because the project environment needs configuring. Do you want to configure project environment first?`;
  const result:|vscode.MessageItem|undefined =
      await vscode.window.showInformationMessage(
          message, DialogResponses.yes, DialogResponses.no);

  if (result === DialogResponses.yes) {
    telemetryContext.properties.errorMessage =
        `${operation} operation failed and user configures project`;
    const res =
        await ProjectEnvironmentConfiger.configureProjectEnvironmentAsPlatform(
            context, channel, telemetryContext, platform, rootPath,
            scaffoldType);
    if (res) {
      const message =
          `Configuration of project environmnet done. You can run the ${
              operation.toLocaleLowerCase()} operation now.`;
      channelShowAndAppendLine(channel, message);
    }
  } else {
    telemetryContext.properties.errorMessage = `${operation} operation failed.`;
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
          `${operation} operation failed on installing Remote Extension.`;
      return false;
    }
    await vscode.commands.executeCommand('openindocker.reopenInContainer');
  } else {
    const message = `${operation} can only be executed in remote container.`;
    channelShowAndAppendLine(channel, message);
    telemetryContext.properties.errorMessage = `${operation} operation failed.`;
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
    root: string, type: ScaffoldType, fileInfo: TemplateFileInfo) {
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

/**
 * If external project, ask whether to configure the project to be IoT Container
 * Project or create an IoT Project
 */
export async function handleExternalProject(
    context: vscode.ExtensionContext, channel: vscode.OutputChannel,
    telemetryContext: TelemetryContext, scaffoldType: ScaffoldType,
    projectFileRootPath: string) {
  const message =
      'An IoT project is needed to process the operation, do you want to configure current project to be an IoT Embedded Linux Project or create an IoT project?';
  class Choice {
    static configureAsContianerProject:
        MessageItem = {title: 'Configure as Embedded Linux Project'};
    static createNewProject: MessageItem = {title: 'Create IoT Project'};
  }

  const result:|vscode.MessageItem|undefined =
      await vscode.window.showInformationMessage(
          message, Choice.configureAsContianerProject, Choice.createNewProject);

  if (result === Choice.configureAsContianerProject) {
    telemetryContext.properties.errorMessage =
        'Operation failed and user configures external project to be an IoT Embedded Linux Project';
    telemetryContext.properties.projectHostType = 'Container';

    const project = new ioTContainerizedProjectModule.IoTContainerizedProject(
        context, channel, telemetryContext);

    // If external project, construct as RaspberryPi Device based
    // container iot workbench project
    await project.constructExternalProjectToIotProject(scaffoldType);

    let res = await project.load(scaffoldType);
    if (!res) {
      throw new Error(
          `Failed to load project. Project environment configuration stopped.`);
    }

    res = await project.configureProjectEnvironmentCore(
        projectFileRootPath, scaffoldType);
    if (!res) {
      throw new Error(
          `Failed to add configuration files. Project environment configuration stopped.`);
    }
    await project.openProject(projectFileRootPath, false);
  } else {
    telemetryContext.properties.errorMessage =
        'Operation failed and user creates new project';
    await vscode.commands.executeCommand('iotworkbench.initializeProject');
  }
}

/**
 * Check if current folder is an IoT Workspace Project but not open correctly.
 * If so, return true and ask to open project properly.
 * If not, return false.
 */
export async function handleIncorrectlyOpenedIoTWorkspaceProject(
    telemetryContext: TelemetryContext): Promise<boolean> {
  if (!(vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length > 0) ||
      !vscode.workspace.workspaceFolders[0]) {
    return false;
  }

  const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const workbenchFileName =
      path.join(rootPath, 'Device', FileNames.iotworkbenchprojectFileName);

  const workspaceFiles = fs.readdirSync(rootPath).filter(
      file => path.extname(file).endsWith(FileNames.workspaceExtensionName));

  if (fs.existsSync(workbenchFileName) && workspaceFiles && workspaceFiles[0]) {
    await askAndOpenProject(rootPath, workspaceFiles[0], telemetryContext);
    return true;
  }

  return false;
}

/**
 * Construct and load iot project.
 * If it is a workspace project not properly opened, prompt to open workspace.
 * If it is properly opened, load project
 */
export async function constructAndLoadIoTProject(
    context: vscode.ExtensionContext, channel: vscode.OutputChannel,
    telemetryContext: TelemetryContext, askNewProject = true) {
  let projectHostType;
  const scaffoldType = ScaffoldType.Workspace;
  if (vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0) {
    const projectFileRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    projectHostType = await IoTWorkbenchProjectBase.getProjectType(
        scaffoldType, projectFileRootPath);
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

    // IoT Workspace Project improperly open as folder,
    // or external project.
    if (iotProject === undefined) {
      const isIncorrectlyOpenedIoTWorkspaceProject =
          await handleIncorrectlyOpenedIoTWorkspaceProject(telemetryContext);
      if (!isIncorrectlyOpenedIoTWorkspaceProject) {
        await handleExternalProject(
            context, channel, telemetryContext, scaffoldType,
            projectFileRootPath);
      }
      return;
    }

    const result = await iotProject.load(scaffoldType);
    if (!result) {
      throw new Error(`Failed to load project.`);
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


enum OverwriteLabel {
  No = 'No',
  YesToAll = 'Yes to all'
}
/**
 * If one of any configuration files already exists, ask to overwrite all or
 * cancel configuration process.
 * @returns true - overwrite all configuration files; false - cancel
 * configuration process.
 */
export async function askToOverwrite(
    scaffoldType: ScaffoldType, projectPath: string,
    templateFilesInfo: TemplateFileInfo[]): Promise<boolean> {
  // Check whether configuration file exists
  for (const fileInfo of templateFilesInfo) {
    const targetFilePath =
        path.join(projectPath, fileInfo.targetPath, fileInfo.fileName);
    if (await FileUtility.fileExists(scaffoldType, targetFilePath)) {
      const fileOverwrite = await askToOverwriteFile(fileInfo.fileName);

      return fileOverwrite.label === OverwriteLabel.YesToAll;
    }
  }

  // No files exist, overwrite directly.
  return true;
}

/**
 * Ask whether to overwrite all configuration files
 */
export async function askToOverwriteFile(fileName: string):
    Promise<vscode.QuickPickItem> {
  const overwriteTasksJsonOption: vscode.QuickPickItem[] = [];
  overwriteTasksJsonOption.push(
      {
        label: OverwriteLabel.No,
        detail:
            'Do not overwrite existed file and cancel the configuration process.'
      },
      {
        label: OverwriteLabel.YesToAll,
        detail: 'Automatically overwrite all configuration files.'
      });

  const overwriteSelection =
      await vscode.window.showQuickPick(overwriteTasksJsonOption, {
        ignoreFocusOut: true,
        placeHolder: `Configuration file ${
            fileName} already exists. Do you want to overwrite all existed configuration files or cancel the configuration process?`
      });

  if (overwriteSelection === undefined) {
    // Selection was cancelled
    throw new CancelOperationError(
        `Ask to overwrite ${fileName} selection cancelled.`);
  }

  return overwriteSelection;
}

export async function fetchAndExecuteTask(
    context: vscode.ExtensionContext, channel: vscode.OutputChannel,
    telemetryContext: TelemetryContext, projectPath: string,
    operationType: OperationType, taskName: string): Promise<boolean> {
  const scaffoldType = ScaffoldType.Workspace;
  if (!await FileUtility.directoryExists(scaffoldType, projectPath)) {
    throw new Error('Unable to find the project folder.');
  }

  const tasks = await vscode.tasks.fetchTasks();
  if (!tasks || tasks.length < 1) {
    const message = `Failed to fetch tasks.`;
    channelShowAndAppendLine(channel, message);

    await askToConfigureEnvironment(
        context, channel, telemetryContext, PlatformType.Arduino, projectPath,
        scaffoldType, operationType);
    return false;
  }

  const operationTask = tasks.filter(task => {
    return task.name === taskName;
  });
  if (!operationTask || operationTask.length < 1) {
    const message = `Failed to fetch default ${
        operationType.toLowerCase()} task with task name ${taskName}.`;
    channelShowAndAppendLine(channel, message);

    await askToConfigureEnvironment(
        context, channel, telemetryContext, PlatformType.Arduino, projectPath,
        scaffoldType, operationType);
    return false;
  }

  try {
    await vscode.tasks.executeTask(operationTask[0]);
  } catch (error) {
    throw new Error(`Failed to execute task to ${
        operationType.toLowerCase()}: ${error.message}`);
  }
  return true;
}

/**
 * Get environment development template files with template name, and ask to
 * overwrite files if any exists
 */
export async function getEnvTemplateFilesAndAskOverwrite(
    context: vscode.ExtensionContext, telemetryContext: TelemetryContext,
    projectPath: string, scaffoldType: ScaffoldType,
    templateName: string): Promise<TemplateFileInfo[]|undefined> {
  if (!projectPath) {
    throw new Error(
        'Unable to find the project path, please open the folder and initialize project again.');
  }

  // Get template list json object
  const templateJsonFilePath = context.asAbsolutePath(path.join(
      FileNames.resourcesFolderName, FileNames.templatesFolderName,
      FileNames.templateFileName));
  const templateJsonFileString =
      await FileUtility.readFile(scaffoldType, templateJsonFilePath, 'utf8') as
      string;
  const templateJson = JSON.parse(templateJsonFileString);
  if (!templateJson) {
    throw new Error('Fail to load template list.');
  }

  // Get environment template files
  const projectEnvTemplate: ProjectTemplate[] =
      templateJson.templates.filter((template: ProjectTemplate) => {
        return (
            template.tag === TemplateTag.DevelopmentEnvironment &&
            template.name === templateName);
      });
  if (projectEnvTemplate.length === 0) {
    throw new Error(
        `Fail to get project development environment template files.`);
  }
  const templateFolderName = projectEnvTemplate[0].path;
  const templateFolder = context.asAbsolutePath(path.join(
      FileNames.resourcesFolderName, FileNames.templatesFolderName,
      templateFolderName));
  const templateFilesInfo: TemplateFileInfo[] =
      await getTemplateFilesInfo(templateFolder);

  // Ask overwrite or not
  let overwriteAll = false;
  try {
    overwriteAll =
        await askToOverwrite(scaffoldType, projectPath, templateFilesInfo);
  } catch (error) {
    if (error instanceof CancelOperationError) {
      telemetryContext.properties.result = 'Cancelled';
      telemetryContext.properties.errorMessage = error.message;
      return;
    } else {
      throw error;
    }
  }
  if (!overwriteAll) {
    const message =
        'Do not overwrite configuration files and cancel configuration process.';
    telemetryContext.properties.errorMessage = message;
    telemetryContext.properties.result = 'Cancelled';
    return;
  }
  return templateFilesInfo;
}