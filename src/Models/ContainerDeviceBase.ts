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
  compileTaskName: 'default compile script'
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
        createTimeScaffoldType, this.projectFolder, this.templateFilesInfo);

    const res = await this.configDeviceEnvironment(
        this.projectFolder, createTimeScaffoldType);

    return res;
  }

  async generateTemplateFiles(
      type: ScaffoldType, projectPath: string,
      templateFilesInfo: TemplateFileInfo[]): Promise<boolean> {
    if (!templateFilesInfo) {
      throw new Error('No template file provided.');
    }

    if (!projectPath) {
      throw new Error(`Project path is empty.`);
    }

    // Cannot use forEach here since it's async
    for (const fileInfo of templateFilesInfo) {
      // Replace binary name in CMakeLists.txt to project name
      if (fileInfo.fileName === 'CMakeLists.txt') {
        const pattern = '${project_name}';
        const projectName = path.basename(projectPath);
        if (fileInfo.fileContent) {
          fileInfo.fileContent =
              fileInfo.fileContent.replace(pattern, projectName);
        }
      }
      await utils.generateTemplateFile(this.projectFolder, type, fileInfo);
    }
    return true;
  }

  async compile(): Promise<boolean> {
    // Check remote
    const isRemote = RemoteExtension.isRemote(this.extensionContext);
    if (!isRemote) {
      const res = await utils.askAndOpenInRemote(
          OperationType.Compile, this.channel, this.telemetryContext);
      if (!res) {
        return false;
      }
    }
    await utils.fetchAndExecuteTask(
        this.extensionContext, this.channel, this.telemetryContext,
        this.projectFolder, OperationType.Compile, constants.compileTaskName);
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
      const message = `Container selection cancelled.`;
      this.telemetryContext.properties.errorMessage = message;
      this.telemetryContext.properties.result = 'Cancelled';
      throw new CancelOperationError(message);
    }
    const templateName = containerSelection.label;
    if (!templateName) {
      throw new Error(
          `Internal Error: Cannot get template name from template property.`);
    }

    const templateFilesInfo = await utils.getEnvTemplateFilesAndAskOverwrite(
        this.extensionContext, this.telemetryContext, this.projectFolder,
        scaffoldType, templateName);
    if (!templateFilesInfo) {
      return false;
    }

    // Configure project environment with template files
    for (const fileInfo of templateFilesInfo) {
      // Replace binary name in tasks.json to project name
      if (fileInfo.fileName === 'tasks.json') {
        const pattern = '${project_name}';
        const projectName = path.basename(projectPath);
        if (fileInfo.fileContent) {
          fileInfo.fileContent =
              fileInfo.fileContent.replace(pattern, projectName);
        }
      }

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
      containerList.push({label: container.name, detail: container.detail});
    });

    const containerSelection =
        await vscode.window.showQuickPick(containerList, {
          ignoreFocusOut: true,
          matchOnDescription: true,
          matchOnDetail: true,
          placeHolder: 'Select a toolchain container for your device platform',
        });

    return containerSelection;
  }
}