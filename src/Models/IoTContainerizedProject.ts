// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from "fs-plus";
import * as path from "path";
import * as vscode from "vscode";

import { RemoteContainersCommands, VscodeCommands } from "../common/Commands";
import { AugumentEmptyOrNullError, PrerequisiteNotMetError, ResourceNotFoundError } from "../common/Error/Error";
import { TypeNotSupportedError } from "../common/Error/TypeNotSupportedError";
import { OperationCanceledError } from "../common/Error/OperationCanceledError";
import { OperationFailedError } from "../common/Error/OperationFailedError";
import { ConfigKey, EventNames, FileNames, ScaffoldType } from "../constants";
import { FileUtility } from "../FileUtility";
import { TelemetryContext, TelemetryWorker } from "../telemetry";
import { getProjectConfig, updateProjectHostTypeConfig } from "../utils";

import { Component } from "./Interfaces/Component";
import { ProjectHostType } from "./Interfaces/ProjectHostType";
import { ProjectTemplateType, TemplateFileInfo } from "./Interfaces/ProjectTemplate";
import { IoTWorkbenchProjectBase, OpenScenario } from "./IoTWorkbenchProjectBase";
import { RemoteExtension } from "./RemoteExtension";

const impor = require("impor")(__dirname);
const raspberryPiDeviceModule = impor("./RaspberryPiDevice") as typeof import("./RaspberryPiDevice");

export class IoTContainerizedProject extends IoTWorkbenchProjectBase {
  constructor(
    context: vscode.ExtensionContext,
    channel: vscode.OutputChannel,
    telemetryContext: TelemetryContext,
    rootFolderPath: string
  ) {
    super(context, channel, telemetryContext);
    this.projectHostType = ProjectHostType.Container;
    if (!rootFolderPath) {
      throw new AugumentEmptyOrNullError("root folder path");
    }
    this.projectRootPath = rootFolderPath;
    this.iotWorkbenchProjectFilePath = path.join(this.projectRootPath, FileNames.iotWorkbenchProjectFileName);
    this.telemetryContext.properties.projectHostType = this.projectHostType;
  }

  async load(scaffoldType: ScaffoldType, initLoad = false): Promise<void> {
    this.validateProjectRootPath(scaffoldType);

    // 1. Update iot workbench project file.
    await updateProjectHostTypeConfig(scaffoldType, this.iotWorkbenchProjectFilePath, this.projectHostType);

    // 2. Send load project event telemetry only if the IoT project is loaded
    // when VS Code opens.
    if (initLoad) {
      this.sendLoadEventTelemetry(this.extensionContext);
    }

    // 3. Init device
    const projectConfigJson = await getProjectConfig(scaffoldType, this.iotWorkbenchProjectFilePath);
    const boardId = projectConfigJson[`${ConfigKey.boardId}`];
    if (!boardId) {
      throw new OperationFailedError(
        `get board id from iot workbench project configuration file ${this.iotWorkbenchProjectFilePath}`
      );
    }
    await this.initDevice(boardId, scaffoldType);
  }

  async create(
    templateFilesInfo: TemplateFileInfo[],
    _projectType: ProjectTemplateType,
    boardId: string,
    openInNewWindow: boolean
  ): Promise<void> {
    // Can only create project locally
    await RemoteExtension.checkRemoteExtension();

    const createTimeScaffoldType = ScaffoldType.Local;

    // Create project root path
    if (!(await FileUtility.directoryExists(createTimeScaffoldType, this.projectRootPath))) {
      await FileUtility.mkdirRecursively(createTimeScaffoldType, this.projectRootPath);
    }

    // Update iot workbench project file
    await updateProjectHostTypeConfig(createTimeScaffoldType, this.iotWorkbenchProjectFilePath, this.projectHostType);

    const projectConfig = await getProjectConfig(createTimeScaffoldType, this.iotWorkbenchProjectFilePath);

    // Step 1: Create device
    await this.initDevice(boardId, createTimeScaffoldType, templateFilesInfo);
    projectConfig[`${ConfigKey.boardId}`] = boardId;

    // Update workspace config to workspace config file
    if (!this.iotWorkbenchProjectFilePath) {
      throw new AugumentEmptyOrNullError("iot workbench project file", "Please initialize the project first.");
    }
    await FileUtility.writeJsonFile(createTimeScaffoldType, this.iotWorkbenchProjectFilePath, projectConfig);

    // Check components prerequisites
    this.componentList.forEach(async item => {
      const res = await item.checkPrerequisites();
      if (!res) {
        throw new PrerequisiteNotMetError("create component");
      }
    });

    // Create components
    try {
      for (let i = 0; i < this.componentList.length; i++) {
        await this.componentList[i].create();
      }
    } catch (error) {
      fs.removeSync(this.projectRootPath);
      throw error;
    }

    // Open project
    await this.openProject(createTimeScaffoldType, openInNewWindow, OpenScenario.createNewProject);
  }

  /**
   * Ask user whether to open project in container directly.
   * If yes, open project in container. If not, stay local.
   */
  async openProject(scaffoldType: ScaffoldType, openInNewWindow: boolean, openScenario: OpenScenario): Promise<void> {
    this.validateProjectRootPath(scaffoldType);

    // 1. Ask to customize
    let openInContainer = false;
    openInContainer = await this.askToOpenInContainer();

    this.telemetryContext.properties.openInContainer = openInContainer.toString();

    // Send all telemetry data before restart the current window.
    if (!openInNewWindow || openInContainer) {
      try {
        const telemetryWorker = TelemetryWorker.getInstance(this.extensionContext);
        const eventNames =
          openScenario === OpenScenario.createNewProject
            ? EventNames.createNewProjectEvent
            : EventNames.configProjectEnvironmentEvent;
        telemetryWorker.sendEvent(eventNames, this.telemetryContext);
      } catch {
        // If sending telemetry failed, skip the error to avoid blocking user.
      }
    }

    // 2. open project
    if (openInContainer) {
      await this.openFolderInContainer(this.projectRootPath);
    } else {
      await vscode.commands.executeCommand(
        VscodeCommands.VscodeOpenFolder,
        vscode.Uri.file(this.projectRootPath),
        openInNewWindow
      );
      // TODO: open install_packages.sh bash script.
    }
  }

  private async openFolderInContainer(folderPath: string): Promise<void> {
    if (!(await FileUtility.directoryExists(ScaffoldType.Local, folderPath))) {
      throw new ResourceNotFoundError("open folder in container", `folder path ${folderPath}`);
    }

    await RemoteExtension.checkRemoteExtension();

    await vscode.commands.executeCommand(RemoteContainersCommands.OpenFolder, vscode.Uri.file(folderPath));
  }

  /**
   * Create and load device component according to board id.
   * Push device to component list.
   * @param boardId board id
   * @param scaffoldType scaffold type
   * @param templateFilesInfo template files info to scaffold files for device
   */
  private async initDevice(
    boardId: string,
    scaffoldType: ScaffoldType,
    templateFilesInfo?: TemplateFileInfo[]
  ): Promise<void> {
    this.validateProjectRootPath(scaffoldType);

    let device: Component;
    if (boardId === raspberryPiDeviceModule.RaspberryPiDevice.boardId) {
      device = new raspberryPiDeviceModule.RaspberryPiDevice(
        this.extensionContext,
        this.projectRootPath,
        this.channel,
        this.telemetryContext,
        templateFilesInfo
      );
    } else {
      throw new TypeNotSupportedError("board type", boardId);
    }

    if (device) {
      this.componentList.push(device);
      await device.load();
    }
  }

  /**
   * Ask whether to open the project in container
   * @returns true - open in container; false - stay local
   */
  private async askToOpenInContainer(): Promise<boolean> {
    const openInContainerOption: vscode.QuickPickItem[] = [];
    openInContainerOption.push(
      {
        label: `Yes`,
        detail: "I want to work on this project in container now."
      },
      {
        label: `No`,
        detail: "I need to customize my container first locally."
      }
    );

    const openInContainerSelection = await vscode.window.showQuickPick(openInContainerOption, {
      ignoreFocusOut: true,
      placeHolder: `Do you want to open in container?`
    });

    if (!openInContainerSelection) {
      throw new OperationCanceledError(`Ask to customize development environment selection cancelled.`);
    }

    return openInContainerSelection.label === "Yes";
  }
}
