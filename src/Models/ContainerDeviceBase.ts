// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Guid } from "guid-typescript";
import * as path from "path";
import * as vscode from "vscode";

import { ResourceNotFoundError } from "../common/Error/OperationFailedErrors/ResourceNotFoundError";
import { ArgumentEmptyOrNullError } from "../common/Error/OperationFailedErrors/ArgumentEmptyOrNullError";
import { OperationCanceledError } from "../common/Error/OperationCanceledError";
import { SystemError } from "../common/Error/SystemErrors/SystemError";
import { FileNames, OperationType, PlatformType, ScaffoldType, TemplateTag } from "../constants";
import { DigitalTwinConstants } from "../DigitalTwin/DigitalTwinConstants";
import { FileUtility } from "../FileUtility";
import { TelemetryContext } from "../telemetry";
import * as utils from "../utils";

import { ComponentType } from "./Interfaces/Component";
import { Device, DeviceType } from "./Interfaces/Device";
import { ProjectTemplate, TemplateFileInfo, TemplatesType } from "./Interfaces/ProjectTemplate";
import { RemoteExtension } from "./RemoteExtension";

const constants = {
  configFile: "config.json",
  compileTaskName: "default compile script"
};

export abstract class ContainerDeviceBase implements Device {
  protected componentId: string;
  get id(): string {
    return this.componentId;
  }
  protected deviceType: DeviceType;
  protected componentType: ComponentType;
  protected projectFolder: string;
  protected channel: vscode.OutputChannel;
  protected extensionContext: vscode.ExtensionContext;
  protected telemetryContext: TelemetryContext;

  protected outputPath: string;

  name = "container base";

  constructor(
    context: vscode.ExtensionContext,
    projectPath: string,
    channel: vscode.OutputChannel,
    telemetryContext: TelemetryContext,
    deviceType: DeviceType,
    protected templateFilesInfo: TemplateFileInfo[] = []
  ) {
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

  async load(): Promise<void> {
    // ScaffoldType is Workspace when loading a project
    const scaffoldType = ScaffoldType.Workspace;
    const operation = "load container device";
    this.validateProjectFolder(operation, scaffoldType);
  }

  async create(): Promise<void> {
    // ScaffoldType is local when creating a project
    const createTimeScaffoldType = ScaffoldType.Local;
    const operation = "create container device";
    this.validateProjectFolder(operation, createTimeScaffoldType);

    await this.generateTemplateFiles(createTimeScaffoldType, this.projectFolder, this.templateFilesInfo);

    await this.configDeviceEnvironment(this.projectFolder, createTimeScaffoldType);
  }

  async generateTemplateFiles(
    type: ScaffoldType,
    projectPath: string,
    templateFilesInfo: TemplateFileInfo[]
  ): Promise<boolean> {
    if (!templateFilesInfo) {
      throw new ArgumentEmptyOrNullError("template files");
    }

    if (!projectPath) {
      throw new ArgumentEmptyOrNullError("project path");
    }

    // Cannot use forEach here since it's async
    for (const fileInfo of templateFilesInfo) {
      // Replace binary name in CMakeLists.txt to project name
      if (fileInfo.fileName === DigitalTwinConstants.cmakeListsFileName) {
        const pattern = /{project_name}/g;
        const projectName = path.basename(projectPath);
        if (fileInfo.fileContent) {
          fileInfo.fileContent = fileInfo.fileContent.replace(pattern, projectName);
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
      await utils.askAndOpenInRemote(OperationType.Compile, this.telemetryContext);
      return false;
    }

    await utils.fetchAndExecuteTask(
      this.extensionContext,
      this.channel,
      this.telemetryContext,
      this.projectFolder,
      OperationType.Compile,
      PlatformType.EmbeddedLinux,
      constants.compileTaskName
    );
    return true;
  }

  abstract async upload(): Promise<boolean>;

  abstract async configDeviceSettings(): Promise<void>;

  async configDeviceEnvironment(projectPath: string, scaffoldType: ScaffoldType): Promise<void> {
    if (!projectPath) {
      throw new ArgumentEmptyOrNullError("project path", "Please open the folder and initialize project again.");
    }

    // Get template list json object
    const templateJson = await utils.getTemplateJson(this.extensionContext, scaffoldType);

    // Select container
    const containerSelection = await this.selectContainer(templateJson);
    if (!containerSelection) {
      throw new OperationCanceledError(`Container selection cancelled.`);
    }
    const templateName = containerSelection.label;
    if (!templateName) {
      throw new SystemError("Cannot get template name from template property");
    }

    const templateFilesInfo = await utils.getEnvTemplateFilesAndAskOverwrite(
      this.extensionContext,
      this.projectFolder,
      scaffoldType,
      templateName
    );
    if (templateFilesInfo.length === 0) {
      throw new SystemError("template files info is empty.");
    }

    // Configure project environment with template files
    for (const fileInfo of templateFilesInfo) {
      // Replace binary name in tasks.json to project name
      if (fileInfo.fileName === "tasks.json") {
        const pattern = "${project_name}";
        const projectName = path.basename(projectPath);
        if (fileInfo.fileContent) {
          fileInfo.fileContent = fileInfo.fileContent.replace(pattern, projectName);
        }
      }

      await utils.generateTemplateFile(projectPath, scaffoldType, fileInfo);
    }

    const message = "Container device configuration done.";
    utils.channelShowAndAppendLine(this.channel, message);
  }

  private async selectContainer(templateListJson: TemplatesType): Promise<vscode.QuickPickItem | undefined> {
    const containerTemplates = templateListJson.templates.filter((template: ProjectTemplate) => {
      return template.tag === TemplateTag.DevelopmentEnvironment && template.platform === PlatformType.EmbeddedLinux;
    });

    const containerList: vscode.QuickPickItem[] = [];
    containerTemplates.forEach((container: ProjectTemplate) => {
      containerList.push({ label: container.name, detail: container.detail });
    });

    const containerSelection = await vscode.window.showQuickPick(containerList, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: "Select a toolchain container for your device platform"
    });

    return containerSelection;
  }

  /**
   * Validate whether project folder exists. If not, throw error.
   * @param operation The caller function's operation for logging
   * @param scaffoldType scaffold type
   */
  async validateProjectFolder(operation: string, scaffoldType: ScaffoldType): Promise<void> {
    if (!(await FileUtility.directoryExists(scaffoldType, this.projectFolder))) {
      throw new ResourceNotFoundError(
        operation,
        `project folder ${this.projectFolder}`,
        "Please initialize the project first."
      );
    }
  }
}
