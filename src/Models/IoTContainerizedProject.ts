// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {CancelOperationError} from '../CancelOperationError';
import {ConfigKey, DevelopEnvironment, EventNames, FileNames, GlobalConstants, ScaffoldType} from '../constants';
import {FileUtility} from '../FileUtility';
import {TelemetryContext, TelemetryProperties, TelemetryWorker} from '../telemetry';
import {channelShowAndAppendLine} from '../utils';

import {ProjectHostType} from './Interfaces/ProjectHostType';
import {ProjectTemplateType, TemplateFileInfo} from './Interfaces/ProjectTemplate';
import {IoTWorkbenchProjectBase} from './IoTWorkbenchProjectBase';
import {RemoteExtension} from './RemoteExtension';

const impor = require('impor')(__dirname);
const raspberryPiDeviceModule =
    impor('./RaspberryPiDevice') as typeof import('./RaspberryPiDevice');

export class IoTContainerizedProject extends IoTWorkbenchProjectBase {
  constructor(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    super(context, channel, telemetryContext);
    this.projectHostType = ProjectHostType.Container;
  }

  async load(scaffoldType: ScaffoldType, initLoad = false): Promise<boolean> {
    if (!(vscode.workspace.workspaceFolders &&
          vscode.workspace.workspaceFolders.length > 0)) {
      return false;
    }

    this.projectRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    await this.generateOrUpdateIotWorkbenchProjectFile(
        scaffoldType, this.projectRootPath);

    const iotworkbenchprojectFile =
        path.join(this.projectRootPath, FileNames.iotworkbenchprojectFileName);
    if (!await FileUtility.fileExists(scaffoldType, iotworkbenchprojectFile)) {
      return false;
    }
    const projectConfigContent =
        await FileUtility.readFile(
            scaffoldType, iotworkbenchprojectFile, 'utf8') as string;
    const projectConfigJson = JSON.parse(projectConfigContent);

    // only send telemetry when the IoT project is load when VS Code opens
    if (initLoad) {
      const properties: TelemetryProperties = {
        result: 'Succeeded',
        error: '',
        errorMessage: ''
      };
      properties.developEnvironment =
          RemoteExtension.isRemote(this.extensionContext) ?
          DevelopEnvironment.Container :
          DevelopEnvironment.LocalEnv;
      properties.projectHostType = ProjectHostType[this.projectHostType];

      const telemetryContext:
          TelemetryContext = {properties, measurements: {duration: 0}};

      try {
        TelemetryWorker.sendEvent(
            EventNames.projectLoadEvent, telemetryContext);
      } catch {
        // If sending telemetry failed, skip the error to avoid blocking user.
      }
    }

    if (this.projectRootPath !== undefined) {
      const boardId = projectConfigJson[`${ConfigKey.boardId}`];
      if (!boardId) {
        return false;
      }
      let device = null;
      if (boardId === raspberryPiDeviceModule.RaspberryPiDevice.boardId) {
        device = new raspberryPiDeviceModule.RaspberryPiDevice(
            this.extensionContext, this.projectRootPath, this.channel,
            this.telemetryContext);
      }

      if (device) {
        this.componentList.push(device);
        await device.load();
      }
    }

    return true;
  }

  async create(
      rootFolderPath: string, templateFilesInfo: TemplateFileInfo[],
      projectType: ProjectTemplateType, boardId: string,
      openInNewWindow: boolean) {
    // Step 0: Check prerequisite
    // Can only create project locally
    const result = await RemoteExtension.checkRemoteExtension(this.channel);
    if (!result) {
      return;
    }

    const createTimeScaffoldType = ScaffoldType.Local;
    if (rootFolderPath !== undefined) {
      await FileUtility.mkdirRecursively(
          createTimeScaffoldType, rootFolderPath);
    } else {
      throw new Error(
          'Unable to find the root path, please open the folder and initialize project again.');
    }

    this.projectRootPath = rootFolderPath;

    await this.generateOrUpdateIotWorkbenchProjectFile(
        createTimeScaffoldType, this.projectRootPath);

    const iotworkbenchprojectFile =
        path.join(this.projectRootPath, FileNames.iotworkbenchprojectFileName);
    if (!await FileUtility.fileExists(
            createTimeScaffoldType, iotworkbenchprojectFile)) {
      throw new Error(
          `Internal Error. Could not find iot workbench project file.`);
    }

    let projectConfig: {[key: string]: string} = {};
    const projectConfigContent =
        (await FileUtility.readFile(
             createTimeScaffoldType, iotworkbenchprojectFile, 'utf8') as string)
            .trim();
    if (projectConfigContent) {
      projectConfig = JSON.parse(projectConfigContent);
    }

    // Step 1: Create device
    let device;
    if (boardId === raspberryPiDeviceModule.RaspberryPiDevice.boardId) {
      device = new raspberryPiDeviceModule.RaspberryPiDevice(
          this.extensionContext, this.projectRootPath, this.channel,
          this.telemetryContext, templateFilesInfo);
    } else {
      throw new Error('The specified board is not supported.');
    }

    projectConfig[`${ConfigKey.boardId}`] = boardId;

    const res = await device.create();
    if (!res) {
      // TODO: Add remove() in FileUtility class
      fs.removeSync(this.projectRootPath);
      vscode.window.showWarningMessage('Project initialize cancelled.');
      return;
    }

    // Step 2: Write project config into iot workbench project file
    if (await FileUtility.fileExists(
            createTimeScaffoldType, iotworkbenchprojectFile)) {
      FileUtility.writeFile(
          createTimeScaffoldType, iotworkbenchprojectFile,
          JSON.stringify(
              projectConfig, null, GlobalConstants.indentationSpace));
    } else {
      throw new Error(
          `Internal Error. Could not find iot workbench project file.`);
    }

    // Open project
    await this.openProject(this.projectRootPath, openInNewWindow);
  }

  /**
   * Ask user whether to customize project environment. If no, open project in
   * remote. If yes, stay local and open bash script for user to customize
   * environment.
   */
  async openProject(projectPath: string, openInNewWindow: boolean) {
    if (!FileUtility.directoryExists(ScaffoldType.Local, projectPath)) {
      channelShowAndAppendLine(
          this.channel, `Can not find project path ${projectPath}.`);
      return;
    }
    // 1. Ask to customize
    let customizeEnvironment = false;
    try {
      customizeEnvironment = await this.askToCustomize();
    } catch (error) {
      if (error instanceof CancelOperationError) {
        this.telemetryContext.properties.errorMessage = error.message;
        this.telemetryContext.properties.result = 'Cancelled';
        return;
      } else {
        throw error;
      }
    }
    this.telemetryContext.properties.customizeEnvironment =
        customizeEnvironment.toString();

    // Wait until all telemetry data is sent before restart the current window.
    if (!openInNewWindow || !customizeEnvironment) {
      // If open in current window, VSCode will restart. Need to send telemetry
      // before VSCode restart to advoid data lost.
      try {
        TelemetryWorker.sendEvent(
            EventNames.createNewProjectEvent, this.telemetryContext);
      } catch {
        // If sending telemetry failed, skip the error to avoid blocking user.
      }
    }

    // 2. open project
    if (!customizeEnvironment) {
      // If user does not want to customize develpment environment,
      //  we will open the project in remote directly for user.
      setTimeout(
          () => vscode.commands.executeCommand(
              'iotcube.openInContainer', projectPath),
          500);
    } else {
      // If user wants to customize development environment, open project
      // locally.
      // TODO: Open bash script in window
      setTimeout(
          () => vscode.commands.executeCommand(
              'iotcube.openLocally', projectPath, openInNewWindow),
          500);
    }
  }

  /**
   * Ask whether to customize the development environment or not
   * @returns true - want to customize; false - don't want to customize
   */
  private async askToCustomize(): Promise<boolean> {
    const customizationOption: vscode.QuickPickItem[] = [];
    customizationOption.push(
        {
          label: `No`,
          detail: 'The project will be opened in container directly.'
        },
        {
          label: `Yes`,
          detail:
              'The project will remain in local environment for you to customize the container.'
        });

    const customizationSelection =
        await vscode.window.showQuickPick(customizationOption, {
          ignoreFocusOut: true,
          placeHolder:
              `Do you want to customize the development environment container now?`
        });

    if (!customizationSelection) {
      throw new CancelOperationError(
          `Ask to customize development environment selection cancelled.`);
    }

    return customizationSelection.label === 'Yes';
  }

  /**
   * Check if it is an external project.
   * If external project, configure as RaspberryPi Device based container iot
   * workbench project.
   */
  async configExternalProjectToIotProject(scaffoldType: ScaffoldType):
      Promise<boolean> {
    if (!(vscode.workspace.workspaceFolders &&
          vscode.workspace.workspaceFolders.length > 0)) {
      return false;
    }

    if (!this.projectRootPath) {
      this.projectRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    const iotworkbenchprojectFile =
        path.join(this.projectRootPath, FileNames.iotworkbenchprojectFileName);

    // Check if cmake project
    const cmakeFile = path.join(this.projectRootPath, FileNames.cmakeFileName);
    if (!await FileUtility.fileExists(scaffoldType, cmakeFile)) {
      const message = `Missing ${
          FileNames.cmakeFileName} to be configured as Embedded Linux project.`;
      channelShowAndAppendLine(this.channel, message);
      vscode.window.showWarningMessage(message);
      return false;
    }

    if (!await FileUtility.fileExists(scaffoldType, iotworkbenchprojectFile)) {
      // This is an external project since no iot workbench project file found.
      // Generate iot workbench project file
      await this.generateOrUpdateIotWorkbenchProjectFile(
          scaffoldType, this.projectRootPath);
    }

    // Set board Id as default type Raspberry Pi
    const projectConfigContent =
        await FileUtility.readFile(
            scaffoldType, iotworkbenchprojectFile, 'utf8') as string;
    const projectConfigJson = JSON.parse(projectConfigContent);
    projectConfigJson[`${ConfigKey.boardId}`] =
        raspberryPiDeviceModule.RaspberryPiDevice.boardId;

    // Step 2: Write project config into iot workbench project file
    await FileUtility.writeFile(
        scaffoldType, iotworkbenchprojectFile,
        JSON.stringify(
            projectConfigJson, null, GlobalConstants.indentationSpace));
    return true;
  }
}