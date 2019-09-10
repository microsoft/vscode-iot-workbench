// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {CancelOperationError} from '../CancelOperationError';
import {ConfigKey, DevelopEnvironment, EventNames, FileNames, PlatformType, ScaffoldType} from '../constants';
import {FileUtility} from '../FileUtility';
import {ProjectEnvironmentConfiger} from '../ProjectEnvironmentConfiger';
import {TelemetryContext, TelemetryProperties, TelemetryWorker} from '../telemetry';
import {channelShowAndAppendLine, generateTemplateFile} from '../utils';

import {ProjectHostType} from './Interfaces/ProjectHostType';
import {ProjectTemplateType, TemplateFileInfo} from './Interfaces/ProjectTemplate';
import {IoTWorkbenchProjectBase} from './IoTWorkbenchProjectBase';
import {RemoteExtension} from './RemoteExtension';

const impor = require('impor')(__dirname);
const raspberryPiDeviceModule =
    impor('./RaspberryPiDevice') as typeof import('./RaspberryPiDevice');

const constants = {
  configPrefix: 'vscode-iot-workbench'
};
export class IoTContainerizedProject extends IoTWorkbenchProjectBase {
  constructor(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    super(context, channel, telemetryContext);
    this.projectHostType = ProjectHostType.Container;
  }

  async load(initLoad = false): Promise<boolean> {
    const loadTimeScaffoldType = ScaffoldType.Workspace;
    if (!(vscode.workspace.workspaceFolders &&
          vscode.workspace.workspaceFolders.length > 0)) {
      return false;
    }

    this.projectRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    const iotworkbenchprojectFile =
        path.join(this.projectRootPath, FileNames.iotworkbenchprojectFileName);
    if (!await FileUtility.fileExists(
            loadTimeScaffoldType, iotworkbenchprojectFile)) {
      return false;
    }
    const projectConfigContent =
        await FileUtility.readFile(
            loadTimeScaffoldType, iotworkbenchprojectFile, 'utf8') as string;
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

    const projectConfig: {[key: string]: string} = {};

    // Step 1: Create device
    let device;
    if (boardId === raspberryPiDeviceModule.RaspberryPiDevice.boardId) {
      device = new raspberryPiDeviceModule.RaspberryPiDevice(
          this.extensionContext, this.projectRootPath, this.channel,
          this.telemetryContext, templateFilesInfo);
    } else {
      throw new Error('The specified board is not supported.');
    }

    projectConfig[`${constants.configPrefix}.${ConfigKey.boardId}`] = boardId;
    // projectConfig[`${constants.configPrefix}.${ConfigKey.projectHostType}`] =
    //     ProjectHostType[this.projectHostType];

    const res = await device.create();
    if (res === false) {
      // TODO: Add remove() in FileUtility class
      fs.removeSync(this.projectRootPath);
      vscode.window.showWarningMessage('Project initialize cancelled.');
      return;
    }

    // Step 2: Write project config into iot workbench project file
    const iotworkbenchprojectFile =
        path.join(this.projectRootPath, FileNames.iotworkbenchprojectFileName);
    if (await FileUtility.fileExists(
            createTimeScaffoldType, iotworkbenchprojectFile)) {
      const indentationSpace = 4;
      FileUtility.writeFile(
          createTimeScaffoldType, iotworkbenchprojectFile,
          JSON.stringify(projectConfig, null, indentationSpace));
    } else {
      throw new Error(
          `Internal Error. Could not find iot workbench project file.`);
    }

    // Configure project and open in container
    const projectEnvConfiger = new ProjectEnvironmentConfiger();
    projectEnvConfiger.configureProjectEnvironmentCore(
        this.extensionContext, this.channel, this.telemetryContext,
        this.projectRootPath, PlatformType.EmbeddedLinux, openInNewWindow);
  }

  async configureProjectEnv(
      channel: vscode.OutputChannel, telemetryContext: TelemetryContext,
      scaffoldType: ScaffoldType, configureRootPath: string,
      templateFilesInfo: TemplateFileInfo[], openInNewWindow: boolean) {
    // 1. Scaffold template files
    for (const fileInfo of templateFilesInfo) {
      await generateTemplateFile(configureRootPath, scaffoldType, fileInfo);
    }

    // 2. Ask to customize
    let customizeEnvironment = false;
    try {
      customizeEnvironment = await this.askToCustomize();
    } catch (error) {
      if (error instanceof CancelOperationError) {
        telemetryContext.properties.errorMessage = error.message;
        telemetryContext.properties.result = 'Cancelled';
        return;
      } else {
        throw error;
      }
    }
    telemetryContext.properties.customizeEnvironment =
        customizeEnvironment.toString();

    // 3. open project
    if (!customizeEnvironment) {
      // If user does not want to customize develpment environment,
      //  we will open the project in remote directly for user.
      setTimeout(
          () => vscode.commands.executeCommand(
              'iotcube.openInContainer', configureRootPath),
          500);
    } else {
      // If user wants to customize development environment, open project
      // locally.
      setTimeout(
          () => vscode.commands.executeCommand(
              'iotcube.openLocally', configureRootPath, openInNewWindow),
          500);
    }

    const message =
        'Configuration is done. You can edit configuration file to customize development environment And then run \'Azure IoT Device Workbench: Compile Device Code\' command to compile device code';

    channelShowAndAppendLine(channel, message);
    vscode.window.showInformationMessage(message);
  }

  /**
   * Ask whether to customize the development environment or not
   * @returns true - want to customize; false - don't want to customize
   */
  private async askToCustomize(): Promise<boolean> {
    const customizationOption: vscode.QuickPickItem[] = [];
    customizationOption.push(
        {label: `Yes`, description: ''}, {label: `No`, description: ''});

    const customizationSelection =
        await vscode.window.showQuickPick(customizationOption, {
          ignoreFocusOut: true,
          placeHolder: `Do you want to customize the development environment?`
        });

    if (customizationSelection === undefined) {
      throw new CancelOperationError(
          `Ask to customization development environment selection cancelled.`);
    }

    return customizationSelection.label === 'Yes';
  }
}