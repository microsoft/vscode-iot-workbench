'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';
import {ExceptionHelper} from './exceptionHelper';
import {IoTProject, ProjectTemplateType} from './Models/IoTProject';


const constants = {
  templateFileName: 'template.json',
  resourceFolderName: 'resources'
};

interface Template {
  label: string;
  detail: string;
  description: string;
}

export class ProjectInitializer {
  async InitializeProject(context: vscode.ExtensionContext) {
    if (!vscode.workspace.rootPath) {
      // Create a folder and select it as the root path

      vscode.window
          .showInformationMessage(
              'Please select the root folder to initialize the project.')
          .then(() => {
            const options: vscode.OpenDialogOptions = {
              canSelectMany: false,
              openLabel: 'Select',
              canSelectFolders: true,
              canSelectFiles: false
            };

            vscode.window.showOpenDialog(options).then(folderUri => {
              if (folderUri && folderUri[0]) {
                console.log(`Selected folder: ${folderUri[0].fsPath}`);
                const uri = vscode.Uri.parse(folderUri[0].fsPath);
                vscode.commands.executeCommand('vscode.openFolder', uri);
              }
            });
          });

      return;
    } else {
      // if the selected folder is not empty, ask user to select another one.
      const files = fs.readdirSync(vscode.workspace.rootPath);
      if (files && files[0]) {
        vscode.window.showInformationMessage(
            'We need an empty folder to initialize the project. ' +
            'Please provide an empty folder');
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

            templateJson.templates.forEach((element: Template) => {
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
            let templateType = ProjectTemplateType.basic;
            switch (selection.label) {
              case 'basic':
                templateType = ProjectTemplateType.basic;
                break;
              case 'iothub':
                templateType = ProjectTemplateType.IotHub;
                break;
              case 'function':
                templateType = ProjectTemplateType.Function;
                break;
              default:
                // Throw exception;
                break;
            }
            const project = new IoTProject();

            // vscode.workspace.rootPath can not be null
            const rootPath: string = vscode.workspace.rootPath as string;
            project.create(rootPath, templateType);
          } catch (error) {
            ExceptionHelper.logError(error, true);
          }
        });
  }
}
