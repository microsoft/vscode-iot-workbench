// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {Guid} from 'guid-typescript';
import * as path from 'path';
import * as vscode from 'vscode';

import {FileNames, OperationType, ScaffoldType} from '../constants';
import {FileUtility} from '../FileUtility';
import {TelemetryContext} from '../telemetry';
import {askAndOpenInRemote, generateTemplateFile, runCommand} from '../utils';

import {ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';
import {TemplateFileInfo} from './Interfaces/ProjectTemplate';
import {IoTWorkbenchProjectBase} from './IoTWorkbenchProjectBase';
import {RemoteExtension} from './RemoteExtension';

const constants = {
  configFile: 'config.json',
  compileTaskName: 'default compile script',
  outputPathInContainer: '/work/output'
};

export abstract class ContainerDeviceBase implements Device {
  protected componentId: string;
  get id() {
    return this.componentId;
  }
  protected deviceType: DeviceType;
  protected componentType: ComponentType;
  protected projectFolder: string;
  protected channel: vscode.OutputChannel;
  protected extensionContext: vscode.ExtensionContext;
  protected telemetryContext: TelemetryContext;

  protected outputPath: string;

  name = 'container base';

  constructor(
      context: vscode.ExtensionContext, projectPath: string,
      channel: vscode.OutputChannel, telemetryContext: TelemetryContext,
      deviceType: DeviceType,
      protected templateFilesInfo: TemplateFileInfo[] = []) {
    this.deviceType = deviceType;
    this.componentType = ComponentType.Device;
    this.channel = channel;
    this.componentId = Guid.create().toString();
    this.extensionContext = context;
    this.projectFolder = projectPath;
    this.outputPath = path.join(this.projectFolder, FileNames.outputPathName);
    this.telemetryContext = telemetryContext;
  }

  getDeviceType(): DeviceType {
    return this.deviceType;
  }

  getComponentType(): ComponentType {
    return this.componentType;
  }

  async checkPrerequisites(): Promise<boolean> {
    return true;
  }

  async load(): Promise<boolean> {
    // ScaffoldType is Workspace when loading a project
    const scaffoldType = ScaffoldType.Workspace;
    if (!await FileUtility.directoryExists(scaffoldType, this.projectFolder)) {
      throw new Error('Unable to find the project folder.');
    }

    return true;
  }

  async create(): Promise<boolean> {
    // ScaffoldType is local when creating a project
    const scaffoldType = ScaffoldType.Local;
    if (!await FileUtility.directoryExists(scaffoldType, this.projectFolder)) {
      throw new Error('Unable to find the project folder.');
    }

    await this.generateTemplateFiles(scaffoldType, this.templateFilesInfo);

    return true;
  }

  async generateTemplateFiles(
      type: ScaffoldType,
      templateFilesInfo: TemplateFileInfo[]): Promise<boolean> {
    if (!templateFilesInfo) {
      throw new Error('No template file provided.');
    }

    // Cannot use forEach here since it's async
    for (const fileInfo of templateFilesInfo) {
      await generateTemplateFile(this.projectFolder, type, fileInfo);
    }
    return true;
  }

  async compile(): Promise<boolean> {
    const isRemote = RemoteExtension.isRemote(this.extensionContext);
    if (!isRemote) {
      const res = await askAndOpenInRemote(
          OperationType.Compile, this.channel, this.telemetryContext);
      if (!res) {
        return false;
      }
    }

    if (!await FileUtility.directoryExists(
            ScaffoldType.Workspace, this.outputPath)) {
      try {
        await FileUtility.mkdirRecursively(
            ScaffoldType.Workspace, this.outputPath);
      } catch (error) {
        throw new Error(`Failed to create output path ${
            this.outputPath}. Error message: ${error.message}`);
      }
    }

    const tasks = await vscode.tasks.fetchTasks();
    if (!tasks || tasks.length < 1) {
      return false;
    }

    const compileTask = tasks.filter(task => {
      return task.name === constants.compileTaskName;
    });
    if (!compileTask || compileTask.length < 1) {
      return false;
    }

    try {
      await vscode.tasks.executeTask(compileTask[0]);
    } catch (error) {
      throw new Error(`Failed to execute compilation task.`);
    }

    vscode.tasks.onDidEndTaskProcess(async (event) => {
      if (event.exitCode === 0) {
        // If task is successfully executed, copy compiled files to user
        // workspace
        if (await FileUtility.directoryExists(
                ScaffoldType.Workspace, constants.outputPathInContainer)) {
          const getOutputFileCmd =
              `cp -rf ${constants.outputPathInContainer}/* ${this.outputPath}`;
          try {
            await runCommand(getOutputFileCmd, [], '', this.channel);
          } catch (error) {
            throw new Error(`Failed to copy compiled files to output folder ${
                this.outputPath}. Error message: ${error.message}`);
          }
          return true;
        } else {
          throw new Error(
              `Internal error: Cannot find output folder ${this.outputPath}.`);
        }
      } else {
        return false;
      }
    });

    return true;
  }

  abstract async upload(): Promise<boolean>;

  abstract async configDeviceSettings(): Promise<boolean>;
}