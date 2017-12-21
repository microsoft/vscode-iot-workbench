'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';
import {ExceptionHelper} from './exceptionHelper';
import {IoTProject, ProjectTemplateType} from './Models/IoTProject';

export class DeviceOperator {
  async compile(context: vscode.ExtensionContext) {
    if (!vscode.workspace.rootPath) {
      ExceptionHelper.logError(
          'Unable to find the root path, please open an IoT Studio project',
          true);
    }

    const project = new IoTProject();
    const rootPath: string = vscode.workspace.rootPath as string;
    project.load(rootPath);
    await project.compile();
  }

  async upload(context: vscode.ExtensionContext) {
    if (!vscode.workspace.rootPath) {
      ExceptionHelper.logError(
          'Unable to find the root path, please open an IoT Studio project',
          true);
    }

    const project = new IoTProject();
    const rootPath: string = vscode.workspace.rootPath as string;
    project.load(rootPath);
    await project.upload();
  }
}
