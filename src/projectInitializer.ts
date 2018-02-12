'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';
import {IoTProject} from './Models/IoTProject';
import {ProjectTemplate, ProjectTemplateType} from './Models/Interfaces/ProjectTemplate';


const constants = {
  templateFileName: 'template.json',
  resourceFolderName: 'resources'
};


export class ProjectInitializer {
  async InitializeProject(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel) {
    let rootPath: string;
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
      vscode.window.showInformationMessage(
          'There are multiple workspaces in the project ' +
          'Please provide an empty folder');
      return;
    } else {
      rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    // if the selected folder is not empty, ask user to select another one.
    const files = fs.readdirSync(rootPath);
    if (files && files[0]) {
      vscode.window.showInformationMessage(
          'We need an empty folder to initialize the project. ' +
          'Please provide an empty folder');
      return;
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

            const result = templateJson.templates.filter(
              function(template: ProjectTemplate){ 
                return template.label === selection.label;
              });

            if (!result) {
              return;
            }

            const project = new IoTProject(context, channel);
            return await project.create(rootPath, result[0]);
          } catch (error) {
            throw error;
          }
        });
  }
}
