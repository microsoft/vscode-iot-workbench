// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as cp from 'child_process';
import * as path from 'path';
import {setTimeout} from 'timers';
import * as vscode from 'vscode';
import * as WinReg from 'winreg';

import {AzureFunctionsLanguage, GlobalConstants, OperationType, DependentExtensions} from './constants';
import {DialogResponses} from './DialogResponses';
import {TelemetryContext} from './telemetry';
import {RemoteExtension} from './Models/RemoteExtension';

export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getRegistryValues(
    hive: string, key: string, name: string): Promise<string> {
  return new Promise(
      async (
          resolve: (value: string) => void, reject: (value: Error) => void) => {
        try {
          const regKey = new WinReg({
            hive,
            key,
          });

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
  folder = await vscode.window.showQuickPick(folderPicks, {placeHolder});
  if (folder === undefined) {
    throw new Error('User cancelled the operation.');
  }

  return folder && folder.data ? folder.data :
                                 (await showOpenDialog(options))[0].fsPath;
}

export async function askAndNewProject(telemetryContext: TelemetryContext) {
  const message =
      'An IoT project is needed to process the operation, do you want to create an IoT project?';
  const result: vscode.MessageItem|undefined =
      await vscode.window.showInformationMessage(
          message, DialogResponses.yes, DialogResponses.no);

  if (result === DialogResponses.yes) {
    telemetryContext.properties.errorMessage =
        'Operation failed and user create new project';
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
  const result: vscode.MessageItem|undefined =
      await vscode.window.showInformationMessage(
          message, DialogResponses.yes, DialogResponses.no);

  if (result === DialogResponses.yes) {
    telemetryContext.properties.errorMessage =
        'Operation failed and user open project from folder.';
    const workspaceFilePath = path.join(rootPath, workspaceFile);
    await vscode.commands.executeCommand(
        'vscode.openFolder', vscode.Uri.file(workspaceFilePath), false);
  } else {
    telemetryContext.properties.errorMessage = 'Operation failed.';
  }
}

export async function askAndOpenInRemote(operation: OperationType, channel: vscode.OutputChannel): Promise<boolean> {
  const message =
      `${operation} can only be executed in remote container. Do you want to reopen the IoT project in container?`;
  const result: vscode.MessageItem|undefined =
      await vscode.window.showInformationMessage(
          message, DialogResponses.yes, DialogResponses.no);

  if (result === DialogResponses.yes) {
    const res = await RemoteExtension.checkRemoteExtension();
    if (!res) {
      const message = `Remote extension is not available. Please install ${DependentExtensions.remote} first.`;
      channel.show();
      channel.appendLine(message);
      return false;
    }
    await vscode.commands.executeCommand('openindocker.reopenInContainer');
  } else {
    const message = `${operation} can only be executed in remote container.`;
    channel.show();
    channel.appendLine(message);
  }

  return false;
}
const noDeviceSurveyUrl = 'https://www.surveymonkey.com/r/C7NY7KJ';

export async function TakeNoDeviceSurvey(telemetryContext: TelemetryContext) {
  const message =
      'Could you help to take a quick survey about what IoT development kit(s) you want Azure IoT Device Workbench to support?';
  const result: vscode.MessageItem|undefined =
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

export class InternalConfig {
  static isInternal: boolean = InternalConfig.isInternalUser();

  private static isInternalUser(): boolean {
    const userDomain = process.env.USERDNSDOMAIN ?
        process.env.USERDNSDOMAIN.toLowerCase() :
        '';
    return userDomain.endsWith('microsoft.com');
  }
}


export function runCommand(
  command: string, workingDir: string,
  outputChannel: vscode.OutputChannel): Thenable<object> {
  return new Promise((resolve, reject) => {
    const stdout = '';
    const stderr = '';
    const process = cp.spawn(command, [], {cwd: workingDir, shell: true});
    process.stdout.on('data', (data: string) => {
      outputChannel.appendLine(data);
    });
    process.stderr.on('data', (data: string) => {
      outputChannel.appendLine(data);
    });
    process.on('error', (error) => reject({error, stderr, stdout}));
    process.on('close', (status) => {
      if (status === 0) {
        resolve({status, stdout, stderr});
      } else {
        reject({status, stdout, stderr});
      }
    });
  });
}