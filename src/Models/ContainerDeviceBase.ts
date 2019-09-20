// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {Guid} from 'guid-typescript';
import * as path from 'path';
import * as vscode from 'vscode';

import {CancelOperationError} from '../CancelOperationError';
import {FileNames, OperationType, PlatformType, ScaffoldType, TemplateTag} from '../constants';
import {FileUtility} from '../FileUtility';
import {TelemetryContext} from '../telemetry';
import * as utils from '../utils';

import {ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';
import {ProjectTemplate, TemplateFileInfo, TemplatesType} from './Interfaces/ProjectTemplate';
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
    const createTimeScaffoldType = ScaffoldType.Local;
    if (!await FileUtility.directoryExists(
            createTimeScaffoldType, this.projectFolder)) {
      throw new Error('Unable to find the project folder.');
    }

    await this.generateTemplateFiles(
        createTimeScaffoldType, this.templateFilesInfo);

    await this.configDeviceEnvironment(
        this.projectFolder, createTimeScaffoldType);

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
      await utils.generateTemplateFile(this.projectFolder, type, fileInfo);
    }
    return true;
  }

  async compile(): Promise<boolean> {
    const isRemote = RemoteExtension.isRemote(this.extensionContext);
    if (!isRemote) {
      const res = await utils.askAndOpenInRemote(
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
            await utils.runCommand(getOutputFileCmd, [], '', this.channel);
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

  async configDeviceEnvironment(
      projectPath: string, scaffoldType: ScaffoldType): Promise<boolean> {
    if (!projectPath) {
      throw new Error(
          'Unable to find the project path, please open the folder and initialize project again.');
    }

    // Get template list json object
    const templateJsonFilePath = this.extensionContext.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName,
        FileNames.templateFileName));
    const templateJsonFileString =
        await FileUtility.readFile(
            scaffoldType, templateJsonFilePath, 'utf8') as string;
    const templateJson = JSON.parse(templateJsonFileString);
    if (!templateJson) {
      throw new Error('Fail to load template list.');
    }

    // Select container
    const containerSelection = await this.selectContainer(templateJson);
    if (!containerSelection) {
      this.telemetryContext.properties.errorMessage =
          'Container selection cancelled.';
      this.telemetryContext.properties.result = 'Cancelled';
      return false;
    }
    const templateName = containerSelection.label;
    if (!templateName) {
      throw new Error(
          `Internal Error: Cannot get template name from template property.`);
    }

    // Get environment template files
    const projectEnvTemplate: ProjectTemplate[] =
        templateJson.templates.filter((template: ProjectTemplate) => {
          return (
              template.tag === TemplateTag.DevelopmentEnvironment &&
              template.name === templateName);
        });
    if (!(projectEnvTemplate && projectEnvTemplate.length > 0)) {
      throw new Error(
          `Fail to get project development environment template files.`);
    }
    const templateFolderName = projectEnvTemplate[0].path;
    const templateFolder = this.extensionContext.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName,
        templateFolderName));
    const templateFilesInfo: TemplateFileInfo[] =
        await utils.getTemplateFilesInfo(templateFolder);

    // Step 3: Ask overwrite or not
    let overwriteAll = false;
    try {
      overwriteAll = await utils.askToOverwrite(
          scaffoldType, projectPath, templateFilesInfo);
    } catch (error) {
      if (error instanceof CancelOperationError) {
        this.telemetryContext.properties.result = 'Cancelled';
        this.telemetryContext.properties.errorMessage = error.message;
        return false;
      } else {
        throw error;
      }
    }
    if (!overwriteAll) {
      const message =
          'Do not overwrite configuration files and cancel configuration process.';
      this.telemetryContext.properties.errorMessage = message;
      this.telemetryContext.properties.result = 'Cancelled';
      return false;
    }

    // Step 4: Configure project environment with template files
    for (const fileInfo of templateFilesInfo) {
      await utils.generateTemplateFile(projectPath, scaffoldType, fileInfo);
    }

    const message = 'Container device configuration done.';
    utils.channelShowAndAppendLine(this.channel, message);

    return true;
  }

  private async selectContainer(templateListJson: TemplatesType):
      Promise<vscode.QuickPickItem|undefined> {
    const containerTemplates =
        templateListJson.templates.filter((template: ProjectTemplate) => {
          return (
              template.tag === TemplateTag.DevelopmentEnvironment &&
              template.platform === PlatformType.EmbeddedLinux);
        });

    const containerList: vscode.QuickPickItem[] = [];
    containerTemplates.forEach((container: ProjectTemplate) => {
      containerList.push(
          {label: container.name, description: container.description});
    });

    const containerSelection =
        await vscode.window.showQuickPick(containerList, {
          ignoreFocusOut: true,
          matchOnDescription: true,
          matchOnDetail: true,
          placeHolder: 'Select a platform',
        });

    return containerSelection;
  }
}