// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {CancelOperationError} from '../CancelOperationError';
import {ConfigKey, EventNames, FileNames, ScaffoldType} from '../constants';
import {FileUtility} from '../FileUtility';
import {TelemetryContext, TelemetryResult, TelemetryWorker} from '../telemetry';
import {channelShowAndAppendLine, getFirstWorkspaceFolderPath} from '../utils';

import {Component} from './Interfaces/Component';
import {ProjectHostType} from './Interfaces/ProjectHostType';
import {ProjectTemplateType, TemplateFileInfo} from './Interfaces/ProjectTemplate';
import {IoTWorkbenchProjectBase, OpenScenario} from './IoTWorkbenchProjectBase';
import {RemoteExtension} from './RemoteExtension';

const impor = require('impor')(__dirname);
const raspberryPiDeviceModule =
    impor('./RaspberryPiDevice') as typeof import('./RaspberryPiDevice');

export class IoTContainerizedProject extends IoTWorkbenchProjectBase {
  constructor(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext, rootFolderPath?: string) {
    super(context, channel, telemetryContext);
    this.projectHostType = ProjectHostType.Container;

    if (rootFolderPath) {
      this.projectRootPath = rootFolderPath;
    } else {
      const firstWorkspaceFolder = getFirstWorkspaceFolderPath();
      if (!firstWorkspaceFolder) {
        throw new Error(`Fail to get first workspace folder.`);
      }
      this.projectRootPath = firstWorkspaceFolder;
    }

    this.iotWorkbenchProjectFilePath =
        path.join(this.projectRootPath, FileNames.iotworkbenchprojectFileName);
  }

  /**
   * Create and load device component according to board id.
   * Push device to component list.
   * @param boardId board id
   * @param scaffoldType scaffold type
   * @param templateFilesInfo template files info to scaffold files for device
   */
  private async initDevice(
      boardId: string, scaffoldType: ScaffoldType,
      templateFilesInfo?: TemplateFileInfo[]): Promise<void> {
    if (!await FileUtility.directoryExists(
            scaffoldType, this.projectRootPath)) {
      throw new Error(`Project root path ${
          this.projectRootPath} does not exist. Please initialize the project first.`);
    }

    let device: Component;
    if (boardId === raspberryPiDeviceModule.RaspberryPiDevice.boardId) {
      device = new raspberryPiDeviceModule.RaspberryPiDevice(
          this.extensionContext, this.projectRootPath, this.channel,
          this.telemetryContext, templateFilesInfo);
    } else {
      throw new Error(`The board ${boardId} is not supported.`);
    }

    if (device) {
      this.componentList.push(device);
      await device.load();
    }
  }

  async load(scaffoldType: ScaffoldType, initLoad = false): Promise<void> {
    if (!await FileUtility.directoryExists(
            scaffoldType, this.projectRootPath)) {
      throw new Error(`Project root path ${
          this.projectRootPath} does not exist. Please initialize the project first.`);
    }

    // 1. Update iot workbench project file.
    await this.updateIotWorkbenchProjectFile(scaffoldType);

    // 2. Send load project event telemetry only if the IoT project is loaded
    // when VS Code opens.
    if (initLoad) {
      this.sendLoadEventTelemetry(this.extensionContext);
    }

    // 3. Init device
    const projectConfigJson = await this.getProjectConfig(scaffoldType);
    const boardId = projectConfigJson[`${ConfigKey.boardId}`];
    if (!boardId) {
      throw new Error(
          `Internal Error: Fail to get board id from configuration.`);
    }
    await this.initDevice(boardId, scaffoldType);
  }

  async create(
      templateFilesInfo: TemplateFileInfo[], projectType: ProjectTemplateType,
      boardId: string, openInNewWindow: boolean): Promise<void> {
    // Can only create project locally
    const isLocal =
        RemoteExtension.checkLocalBeforeRunCommand(this.extensionContext);
    if (!isLocal) {
      return;
    }

    const createTimeScaffoldType = ScaffoldType.Local;

    // Create project root path
    if (!await FileUtility.directoryExists(
            createTimeScaffoldType, this.projectRootPath)) {
      await FileUtility.mkdirRecursively(
          createTimeScaffoldType, this.projectRootPath);
    }

    // Update iot workbench project file
    await this.updateIotWorkbenchProjectFile(createTimeScaffoldType);

    const projectConfig = await this.getProjectConfig(createTimeScaffoldType);

    // Step 1: Create device
    await this.initDevice(boardId, createTimeScaffoldType, templateFilesInfo);
    projectConfig[`${ConfigKey.boardId}`] = boardId;

    // Update workspace config to workspace config file
    if (!this.iotWorkbenchProjectFilePath) {
      throw new Error(
          `Workspace config file path is empty. Please initialize the project first.`);
    }
    await FileUtility.writeJsonFile(
        createTimeScaffoldType, this.iotWorkbenchProjectFilePath,
        projectConfig);

    // Check components prerequisites
    this.componentList.forEach(async item => {
      const res = await item.checkPrerequisites();
      if (!res) {
        return;
      }
    });

    // Create components
    for (let i = 0; i < this.componentList.length; i++) {
      const res = await this.componentList[i].create();
      if (!res) {
        // TODO: Remove this function and implement with sdk in FileUtility
        fs.removeSync(this.projectRootPath);
        vscode.window.showWarningMessage('Project initialization cancelled.');
        return;
      }
    }

    // Open project
    await this.openProject(
        createTimeScaffoldType, openInNewWindow, OpenScenario.createNewProject);
  }

  async openFolderInContainer(folderPath: string) {
    if (!await FileUtility.directoryExists(ScaffoldType.Local, folderPath)) {
      throw new Error(
          `Fail to open folder in container: ${folderPath} does not exist.`);
    }

    const result = await RemoteExtension.checkRemoteExtension(this.channel);
    if (!result) {
      return;
    }

    vscode.commands.executeCommand(
        'remote-containers.openFolder', vscode.Uri.file(folderPath));
  }

  /**
   * Ask user whether to customize project environment. If no, open project in
   * remote. If yes, stay local and open bash script for user to customize
   * environment.
   */
  async openProject(
      scaffoldType: ScaffoldType, openInNewWindow: boolean,
      openScenario: OpenScenario): Promise<void> {
    if (!await FileUtility.directoryExists(
            scaffoldType, this.projectRootPath)) {
      throw new Error(`Project root path ${
          this.projectRootPath} does not exist. Please initialize the project first.`);
    }

    // 1. Ask to customize
    let customizeEnvironment = false;
    try {
      customizeEnvironment = await this.askToCustomize();
    } catch (error) {
      if (error instanceof CancelOperationError) {
        this.telemetryContext.properties.errorMessage = error.message;
        this.telemetryContext.properties.result = TelemetryResult.Cancelled;
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
        const telemetryWorker =
            TelemetryWorker.getInstance(this.extensionContext);
        const eventNames = openScenario === OpenScenario.createNewProject ?
            EventNames.createNewProjectEvent :
            EventNames.configProjectEnvironmentEvent;
        telemetryWorker.sendEvent(eventNames, this.telemetryContext);
      } catch {
        // If sending telemetry failed, skip the error to avoid blocking user.
      }
    }

    // 2. open project
    if (!customizeEnvironment) {
      // If user does not want to customize develpment environment,
      //  we will open the project in remote directly for user.
      await this.openFolderInContainer(this.projectRootPath);
    } else {
      // If user wants to customize development environment, open project
      // locally.
      // TODO: Open bash script in window
      vscode.commands.executeCommand(
          'iotcube.openLocally', this.projectRootPath, openInNewWindow);
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
      await this.updateIotWorkbenchProjectFile(scaffoldType);
    }

    // Set board Id as default type Raspberry Pi
    const projectConfigContent =
        await FileUtility.readFile(
            scaffoldType, iotworkbenchprojectFile, 'utf8') as string;
    const projectConfigJson = JSON.parse(projectConfigContent);
    projectConfigJson[`${ConfigKey.boardId}`] =
        raspberryPiDeviceModule.RaspberryPiDevice.boardId;

    // Step 2: Write project config into iot workbench project file
    await FileUtility.writeJsonFile(
        scaffoldType, iotworkbenchprojectFile, projectConfigJson);
    return true;
  }
}