// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as cp from "child_process";
import * as crypto from "crypto";
import * as fs from "fs-plus";
import * as path from "path";
import * as vscode from "vscode";
import { MessageItem } from "vscode";
import * as sdk from "vscode-iot-device-cube-sdk";
import * as WinReg from "winreg";

import { IoTCubeCommands, RemoteContainersCommands, VscodeCommands, WorkbenchCommands } from "./common/Commands";
import { AugumentEmptyOrNullError, InternalError, ResourceNotFoundError } from "./common/Error/Error";
import { OperationCanceledError } from "./common/Error/OperationCanceledError";
import { OperationFailedError } from "./common/Error/OperationFailedError";
import {
  AzureFunctionsLanguage,
  ConfigKey,
  FileNames,
  OperationType,
  PlatformType,
  ScaffoldType,
  TemplateTag
} from "./constants";
import { DialogResponses } from "./DialogResponses";
import { FileUtility } from "./FileUtility";
import { ProjectHostType } from "./Models/Interfaces/ProjectHostType";
import { ProjectTemplate, TemplateFileInfo } from "./Models/Interfaces/ProjectTemplate";
import { Platform } from "./Models/Interfaces/ProjectTemplate";
import { IoTWorkbenchProjectBase } from "./Models/IoTWorkbenchProjectBase";
import { IoTWorkspaceProject } from "./Models/IoTWorkspaceProject";
import { RemoteExtension } from "./Models/RemoteExtension";
import { ProjectEnvironmentConfiger } from "./ProjectEnvironmentConfiger";
import { TelemetryContext, TelemetryResult } from "./telemetry";
import { WorkbenchExtension } from "./WorkbenchExtension";

const impor = require("impor")(__dirname);
const ioTWorkspaceProjectModule = impor(
  "./Models/IoTWorkspaceProject"
) as typeof import("./Models/IoTWorkspaceProject");
const ioTContainerizedProjectModule = impor(
  "./Models/IoTContainerizedProject"
) as typeof import("./Models/IoTContainerizedProject");
const raspberryPiDeviceModule = impor("./Models/RaspberryPiDevice") as typeof import("./Models/RaspberryPiDevice");

export function delay(ms: number): Promise<unknown> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function channelShowAndAppend(channel: vscode.OutputChannel, message: string): void {
  channel.show();
  channel.append(message);
}

export function channelShowAndAppendLine(channel: vscode.OutputChannel, message: string): void {
  channel.show();
  channel.appendLine(message);
}

export function getRegistryValues(hive: string, key: string, name: string): Promise<string> {
  return new Promise((resolve: (value: string) => void, reject: (value: Error) => void) => {
    try {
      const regKey = new WinReg({ hive, key });

      regKey.valueExists(name, (e, exists) => {
        if (e) {
          return reject(e);
        }
        if (exists) {
          regKey.get(name, (err, result) => {
            if (!err) {
              return resolve(result ? result.value : "");
            } else {
              return reject(err);
            }
          });
        } else {
          return resolve("");
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

export function getScriptTemplateNameFromLanguage(language: string): string | undefined {
  switch (language) {
    case AzureFunctionsLanguage.CSharpScript:
      return "IoTHubTrigger-CSharp";
    case AzureFunctionsLanguage.JavaScript:
      return "IoTHubTrigger-JavaScript";
    case AzureFunctionsLanguage.CSharpLibrary:
      return "Azure.Function.CSharp.IotHubTrigger.2.x";
    default:
      return undefined;
  }
}

/**
 * Provides additional options for QuickPickItems used in Azure Extensions
 */
export interface FolderQuickPickItem<T = undefined> extends vscode.QuickPickItem {
  data: T;
}

/**
 * Check there is workspace opened in VS Code
 * and get the first workspace folder path.
 */
export function getFirstWorkspaceFolderPath(showWarningMessage = true): string {
  if (
    !vscode.workspace.workspaceFolders ||
    vscode.workspace.workspaceFolders.length === 0 ||
    !vscode.workspace.workspaceFolders[0].uri.fsPath
  ) {
    if (showWarningMessage) {
      vscode.window.showWarningMessage(
        "You have not yet opened a folder in Visual Studio Code. Please select a folder first."
      );
    }
    return "";
  }
  return vscode.workspace.workspaceFolders[0].uri.fsPath;
}

export async function showOpenDialog(options: vscode.OpenDialogOptions): Promise<vscode.Uri[]> {
  const result: vscode.Uri[] | undefined = await vscode.window.showOpenDialog(options);

  if (!result) {
    throw new OperationCanceledError("User cancelled the dialog");
  } else {
    return result;
  }
}

export async function selectWorkspaceItem(
  placeHolder: string,
  options: vscode.OpenDialogOptions,
  getSubPath?: (f: vscode.WorkspaceFolder) => string | undefined
): Promise<string> {
  let folderPicks: Array<FolderQuickPickItem<string | undefined>> = [];
  if (vscode.workspace.workspaceFolders) {
    folderPicks = vscode.workspace.workspaceFolders.map((f: vscode.WorkspaceFolder) => {
      let subpath: string | undefined;
      if (getSubPath) {
        subpath = getSubPath(f);
      }

      const fsPath: string = subpath ? path.join(f.uri.fsPath, subpath) : f.uri.fsPath;
      return {
        label: path.basename(fsPath),
        description: fsPath,
        data: fsPath
      };
    });
  }
  folderPicks.push({ label: "Browse...", description: "", data: undefined });
  const folder = await vscode.window.showQuickPick(folderPicks, {
    placeHolder,
    ignoreFocusOut: true
  });
  if (!folder) {
    throw new OperationCanceledError("User cancelled the workspace item selection process");
  }

  return folder && folder.data ? folder.data : (await showOpenDialog(options))[0].fsPath;
}

export async function selectWorkspaceFolder(
  placeHolder: string,
  getSubPath?: (f: vscode.WorkspaceFolder) => string | undefined
): Promise<string> {
  return await selectWorkspaceItem(
    placeHolder,
    {
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri:
        vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
          ? vscode.workspace.workspaceFolders[0].uri
          : undefined,
      openLabel: "Select"
    },
    getSubPath
  );
}

export function executeCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cp.exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      }
      if (stderr) {
        reject(stderr);
      }
      resolve(stdout);
    });
  });
}

export function runCommand(
  command: string,
  args: string[],
  workingDir: string,
  outputChannel: vscode.OutputChannel
): Thenable<object> {
  return new Promise((resolve, reject) => {
    const stdout = "";
    const stderr = "";
    const process = cp.spawn(command, args, { cwd: workingDir, shell: true });
    process.stdout.on("data", (data: string) => {
      console.log(data);
      outputChannel.appendLine(data);
    });
    process.stderr.on("data", (data: string) => {
      console.log(data);
      outputChannel.appendLine(data);
    });
    process.on("error", error => reject({ error, stderr, stdout }));
    process.on("close", status => {
      if (status === 0) {
        resolve({ status, stdout, stderr });
      } else {
        reject({ status, stdout, stderr });
      }
    });
  });
}

/**
 * Pop out information window suggesting user to configure project environment
 * first.
 */
export async function askToConfigureEnvironment(
  context: vscode.ExtensionContext,
  channel: vscode.OutputChannel,
  telemetryContext: TelemetryContext,
  platform: PlatformType,
  deviceRootPath: string,
  scaffoldType: ScaffoldType,
  operation: OperationType
): Promise<void> {
  telemetryContext.properties.result = TelemetryResult.Failed;

  channelShowAndAppendLine(channel, `${operation} operation failed because the project environment needs configuring.`);
  const message = `${operation} operation failed because the project environment needs configuring. \
  Do you want to configure project environment first?`;
  const result: vscode.MessageItem | undefined = await vscode.window.showInformationMessage(
    message,
    DialogResponses.yes,
    DialogResponses.no
  );

  if (result === DialogResponses.yes) {
    telemetryContext.properties.errorMessage = `${operation} operation failed and user configures project environment.`;

    await ProjectEnvironmentConfiger.configureProjectEnvironmentAsPlatform(
      context,
      channel,
      telemetryContext,
      platform,
      deviceRootPath,
      scaffoldType
    );
    const message = `Configuration of project environmnet done. \
    You can run the ${operation.toLocaleLowerCase()} operation now.`;
    channelShowAndAppendLine(channel, message);
    vscode.window.showInformationMessage(message);
  } else {
    const message = `${operation} operation failed and user cancels to configure project environment.`;
    throw new OperationCanceledError(message);
  }
}

/**
 * Ask user to open current IoT project folder as workspace.
 * @param rootPath project root path
 * @param workspaceFile iot workspace config file
 * @param telemetryContext telemetry context
 */
export async function askAndOpenProject(
  rootPath: string,
  workspaceFile: string,
  telemetryContext: TelemetryContext
): Promise<void> {
  telemetryContext.properties.result = TelemetryResult.Failed;

  const message = `Operation failed because the IoT project is not opened. \
  Current folder contains an IoT project '${workspaceFile}', do you want to open it?`;
  const result: vscode.MessageItem | undefined = await vscode.window.showInformationMessage(
    message,
    DialogResponses.yes,
    DialogResponses.no
  );

  if (result === DialogResponses.yes) {
    telemetryContext.properties.errorMessage = "Operation failed and user opens project folder as workspace.";
    const workspaceFilePath = path.join(rootPath, workspaceFile);
    await vscode.commands.executeCommand(IoTCubeCommands.OpenLocally, workspaceFilePath, false);
  } else {
    throw new OperationCanceledError(`Operation failed and user cancels to open current folder as workspace.`);
  }
}

/**
 * Ask user to open project in remote before operation execution.
 * @param operation compile or upload device code operation
 * @param channel output channel
 * @param telemetryContext telemetry context
 */
export async function askAndOpenInRemote(operation: OperationType, telemetryContext: TelemetryContext): Promise<void> {
  telemetryContext.properties.result = TelemetryResult.Failed;

  const message = `${operation} can only be executed in remote container. \
  Do you want to reopen the IoT project in container?`;
  const result: vscode.MessageItem | undefined = await vscode.window.showInformationMessage(
    message,
    DialogResponses.yes,
    DialogResponses.no
  );

  if (result === DialogResponses.yes) {
    telemetryContext.properties.errorMessage = `${operation} operation failed and user reopens project in container.`;
    await RemoteExtension.checkRemoteExtension();

    await vscode.commands.executeCommand(RemoteContainersCommands.ReopenInContainer);
  } else {
    throw new OperationCanceledError(`${operation} operation failed and user cancels to reopen project in container.`);
  }
}

const noDeviceSurveyUrl = "https://www.surveymonkey.com/r/C7NY7KJ";

export async function takeNoDeviceSurvey(
  telemetryContext: TelemetryContext,
  context: vscode.ExtensionContext
): Promise<void> {
  const message =
    "Could you help to take a quick survey about what IoT development kit(s) you want Azure IoT Device Workbench to support?";
  const result: vscode.MessageItem | undefined = await vscode.window.showWarningMessage(
    message,
    DialogResponses.yes,
    DialogResponses.cancel
  );
  if (result === DialogResponses.yes) {
    // Open the survey page
    telemetryContext.properties.message = "User takes no-device survey.";
    telemetryContext.properties.result = TelemetryResult.Succeeded;

    const extension = WorkbenchExtension.getExtension(context);
    if (!extension) {
      return;
    }
    const extensionVersion = extension.packageJSON.version || "unknown";
    await vscode.commands.executeCommand(
      VscodeCommands.VscodeOpen,
      vscode.Uri.parse(
        `${noDeviceSurveyUrl}?o=${encodeURIComponent(process.platform)}&v=${encodeURIComponent(extensionVersion)}`
      )
    );
  }
  return;
}

export async function getTemplateFilesInfo(templateFolder: string): Promise<TemplateFileInfo[]> {
  const templateFilesInfo: TemplateFileInfo[] = [];

  const templateFiles = path.join(templateFolder, FileNames.templateFiles);
  if (!(await FileUtility.fileExists(ScaffoldType.Local, templateFiles))) {
    throw new ResourceNotFoundError("get template files info", `template files ${templateFiles}`);
  }

  const templateFilesJson = JSON.parse(fs.readFileSync(templateFiles, "utf8"));

  templateFilesJson.templateFiles.forEach((fileInfo: TemplateFileInfo) => {
    const filePath = path.join(templateFolder, fileInfo.sourcePath, fileInfo.fileName);
    const fileContent = fs.readFileSync(filePath, "utf8");
    templateFilesInfo.push({
      fileName: fileInfo.fileName,
      sourcePath: fileInfo.sourcePath,
      targetPath: fileInfo.targetPath,
      overwrite: typeof fileInfo.overwrite !== "undefined" ? fileInfo.overwrite : true, // if it is not defined, we will overwrite the existing file.
      fileContent
    });
  });

  return templateFilesInfo;
}

export async function generateTemplateFile(
  root: string,
  type: ScaffoldType,
  fileInfo: TemplateFileInfo
): Promise<void> {
  const targetFolderPath = path.join(root, fileInfo.targetPath);
  if (!(await FileUtility.directoryExists(type, targetFolderPath))) {
    await FileUtility.mkdirRecursively(type, targetFolderPath);
  }

  const targetFilePath = path.join(targetFolderPath, fileInfo.fileName);
  if (fileInfo.fileContent) {
    const fileExist = await FileUtility.fileExists(type, targetFilePath);
    if (fileInfo.overwrite || !fileExist) {
      await FileUtility.writeFile(type, targetFilePath, fileInfo.fileContent);
    }
  }
  return;
}

export function channelPrintJsonObject(
  channel: vscode.OutputChannel,
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  data: any
): void {
  const indentationSpace = 4;
  const jsonString = JSON.stringify(data, null, indentationSpace);
  channelShowAndAppendLine(channel, jsonString);
}

/**
 * If external project, ask whether to configure the project to be IoT Container
 * Project or create an IoT Project
 */
export async function handleExternalProject(telemetryContext: TelemetryContext): Promise<void> {
  telemetryContext.properties.result = TelemetryResult.Failed;
  const message =
    "An IoT project is needed to process the operation, do you want to configure current project to be an IoT Embedded Linux Project or create an IoT project?";
  class Choice {
    static configureAsContainerProject: MessageItem = {
      title: "Configure as Embedded Linux Project"
    };
    static createNewProject: MessageItem = { title: "Create IoT Project" };
  }

  const result: vscode.MessageItem | undefined = await vscode.window.showInformationMessage(
    message,
    Choice.configureAsContainerProject,
    Choice.createNewProject
  );

  if (result === Choice.configureAsContainerProject) {
    telemetryContext.properties.errorMessage =
      "Operation failed and user configures external project to be an IoT Embedded Linux Project";
    await vscode.commands.executeCommand(WorkbenchCommands.ConfigureProjectEnvironment);
  } else if (result === Choice.createNewProject) {
    telemetryContext.properties.errorMessage = "Operation failed and user creates new project";
    await vscode.commands.executeCommand(WorkbenchCommands.InitializeProject);
  } else {
    throw new OperationCanceledError(`Operation failed and user cancels to configure external project.`);
  }
}

/**
 * Get project configs from iot workbench project file
 * @param type Scaffold type
 */
export async function getProjectConfig(
  type: ScaffoldType,
  iotWorkbenchProjectFilePath: string
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
): Promise<any> {
  let projectConfig: { [key: string]: string } = {};
  if (await FileUtility.fileExists(type, iotWorkbenchProjectFilePath)) {
    const projectConfigContent = ((await FileUtility.readFile(
      type,
      iotWorkbenchProjectFilePath,
      "utf8"
    )) as string).trim();
    if (projectConfigContent) {
      projectConfig = JSON.parse(projectConfigContent);
    }
  }
  return projectConfig;
}

export function getWorkspaceFile(rootPath: string): string {
  const workspaceFiles = fs
    .readdirSync(rootPath)
    .filter(file => path.extname(file).endsWith(FileNames.workspaceExtensionName));
  if (workspaceFiles && workspaceFiles.length >= 0) {
    return workspaceFiles[0];
  } else {
    return "";
  }
}

/**
 * Update project host type configuration in iot workbench project file.
 * Create one if not exists.
 * @param type Scaffold type
 */
export async function updateProjectHostTypeConfig(
  type: ScaffoldType,
  iotWorkbenchProjectFilePath: string,
  projectHostType: ProjectHostType
): Promise<void> {
  if (!iotWorkbenchProjectFilePath) {
    throw new AugumentEmptyOrNullError("iot workbench project file path");
  }

  // Get original configs from config file
  const projectConfig = await getProjectConfig(type, iotWorkbenchProjectFilePath);

  // Update project host type
  projectConfig[`${ConfigKey.projectHostType}`] = ProjectHostType[projectHostType];

  // Add config version for easier backward compatibility in the future.
  const workbenchVersion = "1.0.0";
  if (!projectConfig[`${ConfigKey.workbenchVersion}`]) {
    projectConfig[`${ConfigKey.workbenchVersion}`] = workbenchVersion;
  }

  await FileUtility.writeJsonFile(type, iotWorkbenchProjectFilePath, projectConfig);
}

/**
 * Config External CMake Project config file as an IoT Workbench Container
 * Project. Throw cancel operation error if not CMake project. Update project
 * host type and board id in IoT Workbench project file.
 * @param scaffoldType
 */
export async function configExternalCMakeProjectToIoTContainerProject(scaffoldType: ScaffoldType): Promise<void> {
  const projectRootPath = getFirstWorkspaceFolderPath();
  // Check if it is a cmake project
  const cmakeFile = path.join(projectRootPath, FileNames.cmakeFileName);
  if (!(await FileUtility.fileExists(scaffoldType, cmakeFile))) {
    const message = `Missing ${FileNames.cmakeFileName} to be configured as Embedded Linux project.`;
    vscode.window.showWarningMessage(message);
    throw new OperationCanceledError(message);
  }

  const iotWorkbenchProjectFile = path.join(projectRootPath, FileNames.iotWorkbenchProjectFileName);

  // Update project host type in IoT Workbench Project file
  await updateProjectHostTypeConfig(scaffoldType, iotWorkbenchProjectFile, ProjectHostType.Container);

  // Update board Id as Raspberry Pi in IoT Workbench Project file
  const projectConfig = await getProjectConfig(scaffoldType, iotWorkbenchProjectFile);
  projectConfig[`${ConfigKey.boardId}`] = raspberryPiDeviceModule.RaspberryPiDevice.boardId;

  await FileUtility.writeJsonFile(scaffoldType, iotWorkbenchProjectFile, projectConfig);
}

/**
 * Used when it is an IoT workspace project but not open correctly.
 * Ask to open as workspace.
 */
export async function properlyOpenIoTWorkspaceProject(telemetryContext: TelemetryContext): Promise<void> {
  const rootPath = getFirstWorkspaceFolderPath();
  const workbenchFileName = path.join(
    rootPath,
    IoTWorkspaceProject.folderName.deviceDefaultFolderName,
    FileNames.iotWorkbenchProjectFileName
  );
  const workspaceFile = getWorkspaceFile(rootPath);
  if (fs.existsSync(workbenchFileName) && workspaceFile) {
    await askAndOpenProject(rootPath, workspaceFile, telemetryContext);
  }
}

export function isWorkspaceProject(): boolean {
  const rootPath = getFirstWorkspaceFolderPath();
  if (!rootPath) {
    return false;
  }

  const workbenchFileName = path.join(
    rootPath,
    IoTWorkspaceProject.folderName.deviceDefaultFolderName,
    FileNames.iotWorkbenchProjectFileName
  );
  const workspaceFile = getWorkspaceFile(rootPath);
  if (fs.existsSync(workbenchFileName) && workspaceFile) {
    return true;
  }
  return false;
}

/**
 * Construct and load iot project.
 * If this function is triggered by extension load, load project and ignore any
 * error. If this function is triggered by command execution, load project,
 * check project validation and throw error if any.
 */
export async function constructAndLoadIoTProject(
  context: vscode.ExtensionContext,
  channel: vscode.OutputChannel,
  telemetryContext: TelemetryContext,
  isTriggeredWhenExtensionLoad = false
): Promise<IoTWorkbenchProjectBase | undefined> {
  const scaffoldType = ScaffoldType.Workspace;

  const projectFileRootPath = getFirstWorkspaceFolderPath(false);
  const projectHostType = await IoTWorkbenchProjectBase.getProjectType(scaffoldType, projectFileRootPath);

  let iotProject;
  if (projectHostType === ProjectHostType.Container) {
    iotProject = new ioTContainerizedProjectModule.IoTContainerizedProject(
      context,
      channel,
      telemetryContext,
      projectFileRootPath
    );
  } else if (projectHostType === ProjectHostType.Workspace) {
    const projectRootPath = path.join(projectFileRootPath, "..");
    iotProject = new ioTWorkspaceProjectModule.IoTWorkspaceProject(context, channel, telemetryContext, projectRootPath);
  }

  if (isTriggeredWhenExtensionLoad) {
    if (iotProject) {
      try {
        await iotProject.load(scaffoldType, true);
      } catch (error) {
        // Just try to load the project at extension load time. Ignore error
      }
    }
    return;
  }

  // IoT Workspace Project improperly open as folder,
  // or external project.
  if (!iotProject) {
    const isIoTWorkspaceProject = isWorkspaceProject();
    if (isIoTWorkspaceProject) {
      // If current folder is an IoT Workspace Project but not open correctly,
      // ask to open properly
      await properlyOpenIoTWorkspaceProject(telemetryContext);
    } else {
      // If external project
      await handleExternalProject(telemetryContext);
    }
    return;
  }

  await iotProject.load(scaffoldType);

  return iotProject;
}

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
export function getEnumKeyByEnumValue(myEnum: any, enumValue: any): any {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  const keys = Object.keys(myEnum).filter(x => myEnum[x] === enumValue);
  const key = keys.length > 0 ? keys[0] : null;
  if (key === null) {
    return undefined;
  }
  return myEnum[key];
}

export async function selectPlatform(
  type: ScaffoldType,
  context: vscode.ExtensionContext
): Promise<vscode.QuickPickItem | undefined> {
  const platformListPath = context.asAbsolutePath(
    path.join(FileNames.resourcesFolderName, FileNames.templatesFolderName, FileNames.platformListFileName)
  );
  const platformListJsonString = (await FileUtility.readFile(type, platformListPath, "utf8")) as string;
  const platformListJson = JSON.parse(platformListJsonString);

  if (!platformListJson) {
    throw new OperationFailedError(`load platform list ${FileNames.platformListFileName}`);
  }

  const platformList: vscode.QuickPickItem[] = [];

  platformListJson.platforms.forEach((platform: Platform) => {
    platformList.push({
      label: platform.name,
      description: platform.description
    });
  });

  const platformSelection = await vscode.window.showQuickPick(platformList, {
    ignoreFocusOut: true,
    matchOnDescription: true,
    matchOnDetail: true,
    placeHolder: "Select a platform"
  });

  return platformSelection;
}

enum OverwriteLabel {
  No = "No",
  YesToAll = "Yes to all"
}

/**
 * Ask whether to overwrite all configuration files
 */
export async function askToOverwriteFile(fileName: string): Promise<vscode.QuickPickItem> {
  const overwriteTasksJsonOption: vscode.QuickPickItem[] = [];
  overwriteTasksJsonOption.push(
    {
      label: OverwriteLabel.No,
      detail: "Do not overwrite existed file and cancel the configuration process."
    },
    {
      label: OverwriteLabel.YesToAll,
      detail: "Automatically overwrite all configuration files."
    }
  );

  const overwriteSelection = await vscode.window.showQuickPick(overwriteTasksJsonOption, {
    ignoreFocusOut: true,
    placeHolder: `Configuration file ${fileName} already exists. \
      Do you want to overwrite all existed configuration files or cancel the configuration process?`
  });

  if (!overwriteSelection) {
    // Selection was cancelled
    throw new OperationCanceledError(`Ask to overwrite ${fileName} selection cancelled.`);
  }

  return overwriteSelection;
}

/**
 * If one of any configuration files already exists, ask to overwrite all or
 * cancel configuration process.
 * @returns true - overwrite all configuration files; false - cancel
 * configuration process.
 */
export async function askToOverwrite(
  scaffoldType: ScaffoldType,
  projectPath: string,
  templateFilesInfo: TemplateFileInfo[]
): Promise<boolean> {
  // Check whether configuration file exists
  for (const fileInfo of templateFilesInfo) {
    const targetFilePath = path.join(projectPath, fileInfo.targetPath, fileInfo.fileName);
    if (await FileUtility.fileExists(scaffoldType, targetFilePath)) {
      const fileOverwrite = await askToOverwriteFile(fileInfo.fileName);
      return fileOverwrite.label === OverwriteLabel.YesToAll;
    }
  }

  // No files exist, overwrite directly.
  return true;
}

export async function fetchAndExecuteTask(
  context: vscode.ExtensionContext,
  channel: vscode.OutputChannel,
  telemetryContext: TelemetryContext,
  deviceRootPath: string,
  operationType: OperationType,
  platform: PlatformType,
  taskName: string
): Promise<void> {
  const scaffoldType = ScaffoldType.Workspace;
  if (!(await FileUtility.directoryExists(scaffoldType, deviceRootPath))) {
    throw new ResourceNotFoundError("fetch and execute task", `device root folder ${deviceRootPath}`);
  }

  const tasks = await vscode.tasks.fetchTasks();
  if (!tasks || tasks.length < 1) {
    const message = `Failed to fetch tasks.`;
    channelShowAndAppendLine(channel, message);

    await askToConfigureEnvironment(
      context,
      channel,
      telemetryContext,
      platform,
      deviceRootPath,
      scaffoldType,
      operationType
    );
    return;
  }

  const operationTask = tasks.filter(task => {
    return task.name === taskName;
  });
  if (!operationTask || operationTask.length < 1) {
    const message = `Failed to fetch default ${operationType.toLowerCase()} task with task name ${taskName}.`;
    channelShowAndAppendLine(channel, message);

    await askToConfigureEnvironment(
      context,
      channel,
      telemetryContext,
      platform,
      deviceRootPath,
      scaffoldType,
      operationType
    );
    return;
  }

  try {
    await vscode.tasks.executeTask(operationTask[0]);
  } catch (error) {
    throw new Error(`Failed to execute task to ${operationType.toLowerCase()}: ${error.message}`);
  }
  return;
}

/**
 * Get template list json object
 */
export async function getTemplateJson(
  context: vscode.ExtensionContext,
  scaffoldType: ScaffoldType
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
): Promise<any> {
  const templateJsonFilePath = context.asAbsolutePath(
    path.join(FileNames.resourcesFolderName, FileNames.templatesFolderName, FileNames.templateFileName)
  );
  const templateJsonFileString = (await FileUtility.readFile(scaffoldType, templateJsonFilePath, "utf8")) as string;
  const templateJson = JSON.parse(templateJsonFileString);
  if (!templateJson) {
    throw new InternalError("Fail to load template list.");
  }

  return templateJson;
}

/**
 * Get environment development template files with template name, and ask to
 * overwrite files if any exists
 */
export async function getEnvTemplateFilesAndAskOverwrite(
  context: vscode.ExtensionContext,
  projectPath: string,
  scaffoldType: ScaffoldType,
  templateName: string
): Promise<TemplateFileInfo[]> {
  if (!projectPath) {
    throw new AugumentEmptyOrNullError("project path", "Please open the folder and initialize project again.");
  }

  const templateJson = await getTemplateJson(context, scaffoldType);

  // Get environment template files
  const projectEnvTemplate: ProjectTemplate[] = templateJson.templates.filter((template: ProjectTemplate) => {
    return template.tag === TemplateTag.DevelopmentEnvironment && template.name === templateName;
  });
  if (projectEnvTemplate.length === 0) {
    throw new OperationFailedError(
      `get project development environment template files with template name ${templateName}`
    );
  }
  const templateFolderName = projectEnvTemplate[0].path;
  const templateFolder = context.asAbsolutePath(
    path.join(FileNames.resourcesFolderName, FileNames.templatesFolderName, templateFolderName)
  );
  const templateFilesInfo: TemplateFileInfo[] = await getTemplateFilesInfo(templateFolder);

  // Ask overwrite or not
  let overwriteAll = false;
  overwriteAll = await askToOverwrite(scaffoldType, projectPath, templateFilesInfo);

  if (!overwriteAll) {
    const message = "Do not overwrite configuration files and cancel configuration process.";
    throw new OperationCanceledError(message);
  }

  return templateFilesInfo;
}

export async function getPlatform(): Promise<string> {
  const localOs = sdk.Utility.require("os") as typeof import("os");
  const getPlatform = await localOs.platform;
  const platform = await getPlatform();
  return platform;
}

export async function getHomeDir(): Promise<string> {
  const localOs = sdk.Utility.require("os") as typeof import("os");
  const getHomeDir = await localOs.homedir;
  const homeDir = await getHomeDir();
  return homeDir;
}

/**
 * Whether to pop up landing page or not.
 * If this is the first time user use workbench, then pop up landing page.
 * If this is not the first time, don't pop up.
 */
export function shouldShowLandingPage(context: vscode.ExtensionContext): boolean {
  const hasPopUp = context.globalState.get<boolean>(ConfigKey.hasPopUp, false);
  return !hasPopUp;
}

/**
 * Hash a string and get hash value.
 * @param stringToHash string to hash
 * @param algorithm hash algorithm
 */
export function getHashFromString(stringToHash: string, algorithm = "md5"): string {
  const hash = crypto.createHash(algorithm);
  hash.update(stringToHash);
  const hashValue = hash.digest("hex");
  return hashValue;
}
