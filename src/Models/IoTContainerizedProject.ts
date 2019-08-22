// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {ConfigKey, DevelopEnvironment, EventNames, FileNames, ScaffoldType} from '../constants';
import {FileUtility} from '../FileUtility';
import {TelemetryContext, TelemetryProperties, TelemetryWorker} from '../telemetry';
import {ProjectHostType} from './Interfaces/ProjectHostType';
import {ProjectTemplateType, TemplateFileInfo} from './Interfaces/ProjectTemplate';
import {IoTWorkbenchProjectBase} from './IoTWorkbenchProjectBase';
import {RemoteExtension} from './RemoteExtension';


const impor = require('impor')(__dirname);
const raspberryPiDeviceModule =
    impor('./RaspberryPiDevice') as typeof import('./RaspberryPiDevice');
const telemetryModule = impor('../telemetry') as typeof import('../telemetry');

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
    if (!vscode.workspace.workspaceFolders) {
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
      openInNewWindow: boolean): Promise<boolean> {
    // Step 0: Check prerequisite
    // Can only create projcet locally
    const result = await RemoteExtension.checkRemoteExtension(this.channel);
    if (!result) {
      return false;
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
      return false;
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


    // Step 3: Configure project

    // Step 4: Open project
    if (!openInNewWindow) {
      // If open in current window, VSCode will restart. Need to send telemetry
      // before VSCode restart to advoid data lost.
      try {
        telemetryModule.TelemetryWorker.sendEvent(
            EventNames.createNewProjectEvent, this.telemetryContext);
      } catch {
        // If sending telemetry failed, skip the error to avoid blocking user.
      }
    }

    setTimeout(
        () => vscode.commands.executeCommand(
            'iotcube.openLocally', this.projectRootPath, openInNewWindow),
        1000);

    return true;
  }
}