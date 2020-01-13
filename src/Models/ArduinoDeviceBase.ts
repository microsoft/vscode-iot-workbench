// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from "fs-plus";
import * as path from "path";
import * as vscode from "vscode";

import { VscodeCommands } from "../common/Commands";
import { AugumentEmptyOrNullError, ResourceNotFoundError, WorkspaceNotOpenError } from "../common/Error/Error";
import { OperationCanceledError } from "../common/Error/OperationCanceledError";
import { BoardNotFoundError } from "../common/Error/BoardNotFoundError";
import { ConfigNotFoundError } from "../common/Error/ConfigNotFoundError";
import { ConfigHandler } from "../configHandler";
import {
  ConfigKey,
  DependentExtensions,
  FileNames,
  OperationType,
  OSPlatform,
  PlatformType,
  ScaffoldType
} from "../constants";
import { FileUtility } from "../FileUtility";
import { TelemetryContext } from "../telemetry";
import * as utils from "../utils";

import { Board } from "./Interfaces/Board";
import { ComponentType } from "./Interfaces/Component";
import { Device, DeviceType } from "./Interfaces/Device";
import { TemplateFileInfo } from "./Interfaces/ProjectTemplate";
import { OTA } from "./OTA";

const constants = {
  defaultSketchFileName: "device.ino",
  arduinoJsonFileName: "arduino.json",
  cppPropertiesFileName: "c_cpp_properties.json",
  cppPropertiesFileNameMac: "c_cpp_properties_macos.json",
  cppPropertiesFileNameLinux: "c_cpp_properties_linux.json",
  cppPropertiesFileNameWin: "c_cpp_properties_win32.json",
  outputPath: "./.build",
  compileTaskName: "Arduino Compile",
  uploadTaskName: "Arduino Upload",
  environmentTemplateFolderName: "Arduino Task"
};

export abstract class ArduinoDeviceBase implements Device {
  protected deviceType: DeviceType;
  protected componentType: ComponentType;
  protected deviceFolder: string;
  protected vscodeFolderPath: string;
  protected boardFolderPath: string;
  protected channel: vscode.OutputChannel;
  protected extensionContext: vscode.ExtensionContext;
  protected telemetryContext: TelemetryContext;
  protected templateFiles: TemplateFileInfo[] = [];

  abstract name: string;
  abstract id: string;
  abstract board: Board | undefined;

  constructor(
    context: vscode.ExtensionContext,
    devicePath: string,
    channel: vscode.OutputChannel,
    telemetryContext: TelemetryContext,
    deviceType: DeviceType
  ) {
    this.deviceType = deviceType;
    this.componentType = ComponentType.Device;
    this.deviceFolder = devicePath;
    this.extensionContext = context;
    this.vscodeFolderPath = path.join(this.deviceFolder, FileNames.vscodeSettingsFolderName);
    this.boardFolderPath = context.asAbsolutePath(
      path.join(FileNames.resourcesFolderName, FileNames.templatesFolderName)
    );
    this.telemetryContext = telemetryContext;
    this.channel = channel;
  }

  getDeviceType(): DeviceType {
    return this.deviceType;
  }

  getComponentType(): ComponentType {
    return this.componentType;
  }

  static async isAvailable(): Promise<boolean> {
    if (!vscode.extensions.getExtension(DependentExtensions.arduino)) {
      const choice = await vscode.window.showInformationMessage(
        "Arduino extension is required for the current project. Do you want to install it from marketplace?",
        "Yes",
        "No"
      );
      if (choice === "Yes") {
        vscode.commands.executeCommand(
          VscodeCommands.VscodeOpen,
          vscode.Uri.parse("vscode:extension/" + DependentExtensions.arduino)
        );
      }
      return false;
    }

    return true;
  }

  async checkPrerequisites(): Promise<boolean> {
    return await ArduinoDeviceBase.isAvailable();
  }

  async compile(): Promise<boolean> {
    const result = await this.preCompileAction();
    if (!result) {
      return false;
    }

    await utils.fetchAndExecuteTask(
      this.extensionContext,
      this.channel,
      this.telemetryContext,
      this.deviceFolder,
      OperationType.Compile,
      PlatformType.Arduino,
      constants.compileTaskName
    );
    return true;
  }

  async upload(): Promise<boolean> {
    const result = await this.preUploadAction();
    if (!result) {
      return false;
    }
    await utils.fetchAndExecuteTask(
      this.extensionContext,
      this.channel,
      this.telemetryContext,
      this.deviceFolder,
      OperationType.Upload,
      PlatformType.Arduino,
      constants.uploadTaskName
    );
    return true;
  }

  abstract async configDeviceSettings(): Promise<void>;

  async load(): Promise<void> {
    const loadTimeScaffoldType = ScaffoldType.Workspace;
    if (!(await FileUtility.directoryExists(loadTimeScaffoldType, this.deviceFolder))) {
      throw new ResourceNotFoundError("load Arduino device", `device folder ${this.deviceFolder} inside the project`);
    }

    if (!this.board) {
      throw new BoardNotFoundError(this.name);
    }

    await this.generateCppPropertiesFile(loadTimeScaffoldType, this.board);
  }

  abstract async create(): Promise<void>;

  async createCore(): Promise<void> {
    // Generate template files
    const createTimeScaffoldType = ScaffoldType.Local;
    if (!(await FileUtility.directoryExists(createTimeScaffoldType, this.deviceFolder))) {
      throw new ResourceNotFoundError("create Arduino device", `device folder ${this.deviceFolder} inside the project`);
    }
    if (!this.board) {
      throw new BoardNotFoundError(this.name);
    }

    for (const fileInfo of this.templateFiles) {
      await utils.generateTemplateFile(this.deviceFolder, createTimeScaffoldType, fileInfo);
    }

    await this.generateCppPropertiesFile(createTimeScaffoldType, this.board);

    // Configurate device environment
    await this.configDeviceEnvironment(this.deviceFolder, createTimeScaffoldType);
  }

  // Backward compatibility: Check configuration
  abstract async preCompileAction(): Promise<boolean>;

  abstract async preUploadAction(): Promise<boolean>;

  abstract get version(): string;

  private async writeCppPropertiesFile(boardId: string, type: ScaffoldType, platform: string): Promise<void> {
    const cppPropertiesFilePath = path.join(this.vscodeFolderPath, constants.cppPropertiesFileName);

    if (await FileUtility.fileExists(type, cppPropertiesFilePath)) {
      return;
    }

    let cppPropertiesTemplateFileName: string;
    let changeRootPath = false;
    let rootPath: string = await utils.getHomeDir();
    if (platform === OSPlatform.WIN32) {
      rootPath = path.join(rootPath, "AppData", "Local").replace(/\\/g, "\\\\");
      cppPropertiesTemplateFileName = constants.cppPropertiesFileNameWin;
      changeRootPath = true;
    } else if (platform === OSPlatform.LINUX) {
      cppPropertiesTemplateFileName = constants.cppPropertiesFileNameLinux;
      changeRootPath = true;
    } else {
      // TODO: Let's use the MacOS template file for OS that is not win32/linux.
      // Revisit this part if want to support other OS.
      cppPropertiesTemplateFileName = constants.cppPropertiesFileNameMac;
    }

    const cppPropertiesTemplateFilePath = this.extensionContext.asAbsolutePath(
      path.join(FileNames.resourcesFolderName, FileNames.templatesFolderName, boardId, cppPropertiesTemplateFileName)
    );
    const propertiesContent = await FileUtility.readFile(type, cppPropertiesTemplateFilePath);
    const propertiesContentString = propertiesContent.toString();

    const versionPattern = /{VERSION}/g;
    let content = propertiesContentString.replace(versionPattern, this.version);

    if (changeRootPath) {
      const rootPathPattern = /{ROOTPATH}/g;
      content = content.replace(rootPathPattern, rootPath);
    }

    await FileUtility.writeFile(type, cppPropertiesFilePath, content);
  }

  async generateCppPropertiesFile(type: ScaffoldType, board: Board): Promise<void> {
    if (!(await FileUtility.directoryExists(type, this.vscodeFolderPath))) {
      await FileUtility.mkdirRecursively(type, this.vscodeFolderPath);
    }

    // Create c_cpp_properties.json file
    const platform = await utils.getPlatform();
    await this.writeCppPropertiesFile(board.id, type, platform);
  }

  async generateCrc(channel: vscode.OutputChannel): Promise<void> {
    const devicePath = ConfigHandler.get<string>(ConfigKey.devicePath);
    if (!devicePath) {
      throw new ConfigNotFoundError(ConfigKey.devicePath);
    }

    const rootPath = utils.getFirstWorkspaceFolderPath();
    if (!rootPath) {
      throw new WorkspaceNotOpenError();
    }

    const deviceBuildLocation = path.join(rootPath, "..", devicePath, ".build");
    if (!fs.isDirectorySync(deviceBuildLocation)) {
      throw new ResourceNotFoundError(
        "generate CRC",
        "device build output folder",
        "Please compile the project first."
      );
    }

    const binFiles = fs.listSync(deviceBuildLocation, ["bin"]);
    if (!binFiles || !binFiles.length) {
      throw new ResourceNotFoundError("generate CRC", "bin file", "Please compile the project first.");
    }

    let binFilePath = "";

    if (binFiles.length === 1) {
      binFilePath = binFiles[0];
    } else {
      const binFilePickItems: vscode.QuickPickItem[] = [];
      for (const file of binFiles) {
        const fileName = path.basename(file);
        binFilePickItems.push({ label: fileName, description: file });
      }

      const choice = await vscode.window.showQuickPick(binFilePickItems, {
        ignoreFocusOut: true,
        matchOnDescription: true,
        matchOnDetail: true,
        placeHolder: "Select bin file"
      });

      if (!choice || !choice.description) {
        throw new OperationCanceledError("Bin file selection cancelled.");
      }

      binFilePath = choice.description;
    }

    if (!binFilePath || !fs.existsSync(binFilePath)) {
      throw new ResourceNotFoundError(
        "generate CRC",
        `bin file path ${binFilePath}`,
        "Please compile the project first."
      );
    }

    const res = OTA.generateCrc(binFilePath);

    vscode.window.showInformationMessage("Generate CRC succeeded.");

    channel.show();
    channel.appendLine("========== CRC Information ==========");
    channel.appendLine("");
    channel.appendLine("fwPath: " + binFilePath);
    channel.appendLine("fwPackageCheckValue: " + res.crc);
    channel.appendLine("fwSize: " + res.size);
    channel.appendLine("");
    channel.appendLine("======================================");
  }

  async configDeviceEnvironment(deviceRootPath: string, scaffoldType: ScaffoldType): Promise<void> {
    if (!deviceRootPath) {
      throw new AugumentEmptyOrNullError("device root path", "Please open the folder and initialize project again.");
    }

    const templateFilesInfo = await utils.getEnvTemplateFilesAndAskOverwrite(
      this.extensionContext,
      this.deviceFolder,
      scaffoldType,
      constants.environmentTemplateFolderName
    );

    // Configure project environment with template files
    for (const fileInfo of templateFilesInfo) {
      await utils.generateTemplateFile(deviceRootPath, scaffoldType, fileInfo);
    }

    const message = "Arduino device configuration done.";
    utils.channelShowAndAppendLine(this.channel, message);
  }
}
