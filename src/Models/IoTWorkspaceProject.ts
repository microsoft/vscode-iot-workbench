// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from "fs-plus";
import * as path from "path";
import * as vscode from "vscode";

import { IoTCubeCommands } from "../common/Commands";

import { ArgumentEmptyOrNullError } from "../common/Error/OperationFailedErrors/ArgumentEmptyOrNullError";
import { WorkspaceConfigNotFoundError } from "../common/Error/SystemErrors/WorkspaceConfigNotFoundError";
import { TypeNotSupportedError } from "../common/Error/SystemErrors/TypeNotSupportedError";
import { ConfigHandler } from "../configHandler";
import { ConfigKey, EventNames, FileNames, ScaffoldType } from "../constants";
import { FileUtility } from "../FileUtility";
import { TelemetryContext, TelemetryWorker } from "../telemetry";
import { getWorkspaceFile, updateProjectHostTypeConfig } from "../utils";

import { AzureComponentConfig } from "./AzureComponentConfig";
import { Component, ComponentType } from "./Interfaces/Component";
import { ProjectHostType } from "./Interfaces/ProjectHostType";
import { ProjectTemplateType, TemplateFileInfo } from "./Interfaces/ProjectTemplate";
import { Workspace } from "./Interfaces/Workspace";
import { IoTWorkbenchProjectBase, OpenScenario } from "./IoTWorkbenchProjectBase";
import { DirectoryNotFoundError } from "../common/Error/OperationFailedErrors/DirectoryNotFoundError";
import { FileNotFoundError } from "../common/Error/OperationFailedErrors/FileNotFound";

const impor = require("impor")(__dirname);
const az3166DeviceModule = impor("./AZ3166Device") as typeof import("./AZ3166Device");
const azureComponentConfigModule = impor("./AzureComponentConfig") as typeof import("./AzureComponentConfig");
const azureFunctionsModule = impor("./AzureFunctions") as typeof import("./AzureFunctions");
const esp32DeviceModule = impor("./Esp32Device") as typeof import("./Esp32Device");
const ioTHubModule = impor("./IoTHub") as typeof import("./IoTHub");
const ioTHubDeviceModule = impor("./IoTHubDevice") as typeof import("./IoTHubDevice");

export class IoTWorkspaceProject extends IoTWorkbenchProjectBase {
  private deviceRootPath = "";
  private workspaceConfigFilePath = "";

  static folderName = {
    deviceDefaultFolderName: "Device",
    functionDefaultFolderName: "Functions"
  };

  constructor(
    context: vscode.ExtensionContext,
    channel: vscode.OutputChannel,
    telemetryContext: TelemetryContext,
    rootFolderPath: string
  ) {
    super(context, channel, telemetryContext);
    this.projectHostType = ProjectHostType.Workspace;
    if (!rootFolderPath) {
      throw new ArgumentEmptyOrNullError(
        "construct iot workspace project",
        "root folder path",
        "Please initialize iot workspace project with root folder path."
      );
    }
    this.projectRootPath = rootFolderPath;
    this.telemetryContext.properties.projectHostType = this.projectHostType;
  }

  async load(scaffoldType: ScaffoldType, initLoad = false): Promise<void> {
    this.validateProjectRootPath("load project", scaffoldType);

    // Init device root path
    const devicePath = ConfigHandler.get<string>(ConfigKey.devicePath);
    if (!devicePath) {
      throw new WorkspaceConfigNotFoundError(ConfigKey.devicePath);
    }
    this.deviceRootPath = path.join(this.projectRootPath, devicePath);
    if (!(await FileUtility.directoryExists(scaffoldType, this.deviceRootPath))) {
      throw new DirectoryNotFoundError(
        "load iot workspace project",
        `device root path ${this.deviceRootPath}`,
        "Please initialize the project first."
      );
    }

    // Init and update iot workbench project file
    this.iotWorkbenchProjectFilePath = path.join(this.deviceRootPath, FileNames.iotWorkbenchProjectFileName);
    await updateProjectHostTypeConfig(scaffoldType, this.iotWorkbenchProjectFilePath, this.projectHostType);

    // Init workspace config file
    this.loadAndInitWorkspaceConfigFilePath(scaffoldType);

    // Send load project event telemetry only if the IoT project is loaded
    // when VS Code opens.
    if (initLoad) {
      this.sendLoadEventTelemetry(this.extensionContext);
    }

    const boardId = ConfigHandler.get<string>(ConfigKey.boardId);
    if (!boardId) {
      throw new WorkspaceConfigNotFoundError(ConfigKey.boardId);
    }
    await this.initDevice(boardId, scaffoldType);

    await this.initAzureConfig(scaffoldType);

    // Check components prerequisites
    this.componentList.forEach(async item => {
      await item.checkPrerequisites();
    });
  }

  async create(
    templateFilesInfo: TemplateFileInfo[],
    projectType: ProjectTemplateType,
    boardId: string,
    openInNewWindow: boolean
  ): Promise<void> {
    const createTimeScaffoldType = ScaffoldType.Local;

    // Init device root path
    this.deviceRootPath = path.join(this.projectRootPath, IoTWorkspaceProject.folderName.deviceDefaultFolderName);
    if (!(await FileUtility.directoryExists(createTimeScaffoldType, this.deviceRootPath))) {
      await FileUtility.mkdirRecursively(createTimeScaffoldType, this.deviceRootPath);
    }
    // Init iot workbench project file path
    this.iotWorkbenchProjectFilePath = path.join(this.deviceRootPath, FileNames.iotWorkbenchProjectFileName);
    // Init workspace config file
    this.workspaceConfigFilePath = path.join(
      this.projectRootPath,
      `${path.basename(this.projectRootPath)}${FileNames.workspaceExtensionName}`
    );

    // Update iot workbench project file.
    await updateProjectHostTypeConfig(createTimeScaffoldType, this.iotWorkbenchProjectFilePath, this.projectHostType);

    const workspace: Workspace = { folders: [], settings: {} };

    // Init device
    await this.initDevice(boardId, createTimeScaffoldType, templateFilesInfo);
    workspace.folders.push({ path: IoTWorkspaceProject.folderName.deviceDefaultFolderName });
    workspace.settings[`IoTWorkbench.${ConfigKey.boardId}`] = boardId;
    workspace.settings[`IoTWorkbench.${ConfigKey.devicePath}`] = IoTWorkspaceProject.folderName.deviceDefaultFolderName;

    // Create azure components
    await this.createAzureComponentsWithProjectType(projectType, createTimeScaffoldType, workspace);

    // Update workspace config to workspace config file
    if (!this.workspaceConfigFilePath) {
      throw new ArgumentEmptyOrNullError(
        "update workspace config file",
        "workspace configuration file path",
        "Please initialize the project first."
      );
    }
    await FileUtility.writeJsonFile(createTimeScaffoldType, this.workspaceConfigFilePath, workspace);

    // Check components prerequisites
    this.componentList.forEach(async item => {
      const res = await item.checkPrerequisites();
      if (!res) {
        return;
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

  async openProject(scaffoldType: ScaffoldType, openInNewWindow: boolean, openScenario: OpenScenario): Promise<void> {
    this.loadAndInitWorkspaceConfigFilePath(scaffoldType);

    if (!(await FileUtility.fileExists(scaffoldType, this.workspaceConfigFilePath))) {
      throw new FileNotFoundError(
        "open project",
        `workspace configuration file ${this.workspaceConfigFilePath}`,
        "Please initialize the project first.`"
      );
    }

    if (!openInNewWindow) {
      // If open in current window, VSCode will restart. Need to send telemetry
      // before VSCode restart to advoid data lost.
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

    vscode.commands.executeCommand(IoTCubeCommands.OpenLocally, this.workspaceConfigFilePath, openInNewWindow);
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
    if (!(await FileUtility.directoryExists(scaffoldType, this.deviceRootPath))) {
      throw new DirectoryNotFoundError(
        "initialize device",
        `device root path: ${this.deviceRootPath}`,
        "Please initialize the project first."
      );
    }

    let device: Component;
    if (boardId === az3166DeviceModule.AZ3166Device.boardId) {
      device = new az3166DeviceModule.AZ3166Device(
        this.extensionContext,
        this.channel,
        this.telemetryContext,
        this.deviceRootPath,
        templateFilesInfo
      );
    } else if (boardId === esp32DeviceModule.Esp32Device.boardId) {
      device = new esp32DeviceModule.Esp32Device(
        this.extensionContext,
        this.channel,
        this.telemetryContext,
        this.deviceRootPath,
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
   * For backward compatibility.
   * If no azure components configs found in azure config files,
   * init azure components and update azure config files.
   * @param scaffoldType Scaffold type
   */
  private async initAzureComponentsWithoutConfig(scaffoldType: ScaffoldType): Promise<void> {
    this.validateProjectRootPath("init azure components without configuration", scaffoldType);

    const iotHub = new ioTHubModule.IoTHub(this.projectRootPath, this.channel);
    await iotHub.updateConfigSettings(scaffoldType);
    await iotHub.load();
    this.componentList.push(iotHub);

    const iotHubDevice = new ioTHubDeviceModule.IoTHubDevice(this.projectRootPath, this.channel, [
      {
        component: iotHub,
        type: azureComponentConfigModule.DependencyType.Input
      }
    ]);
    await iotHubDevice.updateConfigSettings(scaffoldType);
    await iotHubDevice.load();
    this.componentList.push(iotHubDevice);

    const functionPath = ConfigHandler.get<string>(ConfigKey.functionPath);
    if (functionPath) {
      const functionLocation = path.join(this.projectRootPath, functionPath);
      const functionApp = new azureFunctionsModule.AzureFunctions(
        this.projectRootPath,
        functionLocation,
        functionPath,
        this.channel,
        null,
        [
          {
            component: iotHub,
            type: azureComponentConfigModule.DependencyType.Input
          }
        ]
      );
      await functionApp.updateConfigSettings(scaffoldType);
      await functionApp.load();
      this.componentList.push(functionApp);
    }
  }

  /**
   * Init Azure components according to configs.
   * Create and load azure components. Push to component list.
   * @param scaffoldType scaffold type
   * @param componentConfigs azure component configs
   */
  private async initAzureComponentsWithConfig(
    scaffoldType: ScaffoldType,
    componentConfigs: AzureComponentConfig[]
  ): Promise<void> {
    this.validateProjectRootPath("initialize azure components with configurations", scaffoldType);

    const components: { [key: string]: Component } = {};
    for (const componentConfig of componentConfigs) {
      switch (componentConfig.type) {
        case ComponentType.IoTHub: {
          const iotHub = new ioTHubModule.IoTHub(this.projectRootPath, this.channel);
          await iotHub.load();
          components[iotHub.id] = iotHub;
          this.componentList.push(iotHub);

          const iothubDevice = new ioTHubDeviceModule.IoTHubDevice(this.projectRootPath, this.channel, [
            {
              component: iotHub,
              type: azureComponentConfigModule.DependencyType.Input
            }
          ]);
          await iothubDevice.load();
          components[iothubDevice.id] = iothubDevice;
          this.componentList.push(iothubDevice);

          break;
        }
        case ComponentType.IoTHubDevice: {
          break;
        }
        case ComponentType.AzureFunctions: {
          const functionPath = ConfigHandler.get<string>(ConfigKey.functionPath);
          if (!functionPath) {
            throw new WorkspaceConfigNotFoundError(ConfigKey.functionPath);
          }

          const functionLocation = path.join(this.projectRootPath, functionPath);
          if (functionLocation) {
            const functionApp = new azureFunctionsModule.AzureFunctions(
              this.projectRootPath,
              functionLocation,
              functionPath,
              this.channel
            );
            await functionApp.load();
            components[functionApp.id] = functionApp;
            this.componentList.push(functionApp);
          }
          break;
        }
        default: {
          throw new TypeNotSupportedError("component type", `${componentConfig.type}`);
        }
      }
    }
  }

  /**
   * Init Azure components and azure configs.
   * @param scaffoldType scaffold type
   */
  private async initAzureConfig(scaffoldType: ScaffoldType): Promise<void> {
    this.validateProjectRootPath("initialize azure configurations", scaffoldType);

    const azureConfigFileHandler = new azureComponentConfigModule.AzureConfigFileHandler(this.projectRootPath);
    await azureConfigFileHandler.createIfNotExists(scaffoldType);

    const componentConfigs = await azureConfigFileHandler.getSortedComponents(scaffoldType);

    if (componentConfigs.length === 0) {
      // Support backward compact
      await this.initAzureComponentsWithoutConfig(scaffoldType);
    } else {
      await this.initAzureComponentsWithConfig(scaffoldType, componentConfigs);
    }
  }

  private async createAzureComponentsWithProjectType(
    projectType: ProjectTemplateType,
    scaffoldType: ScaffoldType,
    workspaceConfig: Workspace
  ): Promise<void> {
    this.validateProjectRootPath("init azure components", scaffoldType);

    // initialize the storage for azure component settings
    const azureConfigFileHandler = new azureComponentConfigModule.AzureConfigFileHandler(this.projectRootPath);
    await azureConfigFileHandler.createIfNotExists(scaffoldType);

    switch (projectType) {
      case ProjectTemplateType.Basic:
        // Save data to configFile
        break;
      case ProjectTemplateType.IotHub: {
        const iothub = new ioTHubModule.IoTHub(this.projectRootPath, this.channel);
        this.componentList.push(iothub);
        break;
      }
      case ProjectTemplateType.AzureFunctions: {
        const iothub = new ioTHubModule.IoTHub(this.projectRootPath, this.channel);

        const functionDir = path.join(this.projectRootPath, IoTWorkspaceProject.folderName.functionDefaultFolderName);
        if (!(await FileUtility.directoryExists(scaffoldType, functionDir))) {
          await FileUtility.mkdirRecursively(scaffoldType, functionDir);
        }
        const azureFunctions = new azureFunctionsModule.AzureFunctions(
          this.projectRootPath,
          functionDir,
          IoTWorkspaceProject.folderName.functionDefaultFolderName,
          this.channel,
          null,
          [
            {
              component: iothub,
              type: azureComponentConfigModule.DependencyType.Input
            }
          ] /*Dependencies*/
        );

        workspaceConfig.folders.push({ path: IoTWorkspaceProject.folderName.functionDefaultFolderName });
        workspaceConfig.settings[`IoTWorkbench.${ConfigKey.functionPath}`] =
          IoTWorkspaceProject.folderName.functionDefaultFolderName;

        this.componentList.push(iothub);
        this.componentList.push(azureFunctions);
        break;
      }
      default:
        break;
    }
  }

  // Init workspace config file path at load time
  private async loadAndInitWorkspaceConfigFilePath(scaffoldType: ScaffoldType): Promise<void> {
    this.validateProjectRootPath("init workspace config file path", scaffoldType);

    const workspaceFile = getWorkspaceFile(this.projectRootPath);
    if (!workspaceFile) {
      throw new FileNotFoundError(
        "init iot project workspace file path",
        `workspace file under project root path: ${this.projectRootPath}.`,
        ""
      );
    }
    this.workspaceConfigFilePath = path.join(this.projectRootPath, workspaceFile);
  }
}
