'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';
import {IoTProject} from './Models/IoTProject';
import {ProjectTemplate, ProjectTemplateType} from './Models/Interfaces/ProjectTemplate';
import {DialogResponses} from './DialogResponses';
import {IoTDevSettings} from './IoTSettings';
import * as utils from './utils';

const constants = {
  templateFileName: 'template.json',
  resourceFolderName: 'resources',
  defaultProjectName: 'IoTproject'
};


export class ProjectInitializer {
  async InitializeProject(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel) {
    let rootPath: string;
    let openInNewWindow = false;
    if (!vscode.workspace.workspaceFolders) {
      // Create a folder and select it as the root path
      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: 'Select',
        canSelectFolders: true,
        canSelectFiles: false
      };

      const folderUri = await vscode.window.showOpenDialog(options);
      if (folderUri && folderUri[0]) {
        console.log(`Selected folder: ${folderUri[0].fsPath}`);
        rootPath = folderUri[0].fsPath;
      } else {
        return;
      }
    } else if (vscode.workspace.workspaceFolders.length > 1) {
      const message =
          'There are multiple workspaces in the project. Initialize new project in default directory?';
      const result: vscode.MessageItem|undefined =
          await vscode.window.showWarningMessage(
              message, DialogResponses.yes, DialogResponses.cancel);
      if (result === DialogResponses.yes) {
        rootPath = this.GenerateProjectFolder();
        openInNewWindow = true;
      } else {
        return;
      }
    } else {
      rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    // if the selected folder is not empty, ask user to select another one.
    const files = fs.readdirSync(rootPath);
    if (files && files[0]) {
      const message =
          'An empty folder is required initialize the project. Initialize new project in default directory?';
      const result: vscode.MessageItem|undefined =
          await vscode.window.showWarningMessage(
              message, DialogResponses.yes, DialogResponses.cancel);
      if (result === DialogResponses.yes) {
        rootPath = this.GenerateProjectFolder();
        openInNewWindow = true;
      } else {
        return;
      }
    }

    // Initial project
    await vscode.window.withProgress(
        {
          title: 'Devkit project initialization',
          location: vscode.ProgressLocation.Window,
        },
        async (progress) => {
          progress.report({
            message: 'Updating a list of avaialbe template',
          });

          try {
            // Template select
            const template = context.asAbsolutePath(path.join(
                constants.resourceFolderName, constants.templateFileName));
            const templateJson = require(template);

            const projectTemplateList: vscode.QuickPickItem[] = [];

            templateJson.templates.forEach((element: ProjectTemplate) => {
              projectTemplateList.push({
                label: element.label,
                description: element.description,
                detail: element.detail
              });
            });

            const selection =
                await vscode.window.showQuickPick(projectTemplateList, {
                  ignoreFocusOut: true,
                  matchOnDescription: true,
                  matchOnDetail: true,
                  placeHolder: 'Select a project template',
                });

            if (!selection) {
              return;
            }

            const result =
                templateJson.templates.filter((template: ProjectTemplate) => {
                  return template.label === selection.label;
                });

            if (!result) {
              return;
            }

            const project = new IoTProject(context, channel);
            return await project.create(rootPath, result[0], openInNewWindow);
          } catch (error) {
            throw error;
          }
        });
  }


  private GenerateProjectFolder(): string {
    const settings: IoTDevSettings = new IoTDevSettings();
    if (!utils.directoryExistsSync(settings.defaultProjectsPath)) {
      utils.mkdirRecursivelySync(settings.defaultProjectsPath);
    }

    let counter = 0;
    const name =
        path.join(settings.defaultProjectsPath, constants.defaultProjectName);
    let candidateName = name;
    while (true) {
      if (!utils.fileExistsSync(candidateName) &&
          !utils.directoryExistsSync(candidateName)) {
        utils.mkdirRecursivelySync(candidateName);
        return candidateName;
      }
      counter++;
      candidateName = `${name}_${counter}`;
    }
  }
}
