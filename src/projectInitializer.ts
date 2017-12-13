'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {exceptionHelper} from './exceptionHelper';

export class ProjectInitializer {
  async InitializeProject() {
    if (!vscode.workspace.rootPath) {
      // TODO: create a folder and select it as the root path
    }

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
            // TODO: add logic to initialize a project

          } catch (error) {
            exceptionHelper(error, true);
          }
        });
  }
}
