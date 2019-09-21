// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import {open} from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {CancelOperationError} from '../CancelOperationError';
import {ConfigHandler} from '../configHandler';
import {ConfigKey, DependentExtensions, FileNames, OperationType, PlatformType, ScaffoldType, TemplateTag} from '../constants';
import {FileUtility} from '../FileUtility';
import {IoTWorkbenchSettings} from '../IoTSettings';
import {TelemetryContext} from '../telemetry';
import * as utils from '../utils';

import {Board} from './Interfaces/Board';
import {ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';
import {ProjectTemplate, TemplateFileInfo} from './Interfaces/ProjectTemplate';
import {OTA} from './OTA';

const constants = {
  defaultSketchFileName: 'device.ino',
  arduinoJsonFileName: 'arduino.json',
  cppPropertiesFileName: 'c_cpp_properties.json',
  cppPropertiesFileNameMac: 'c_cpp_properties_macos.json',
  cppPropertiesFileNameWin: 'c_cpp_properties_win32.json',
  outputPath: './.build',
  compileTaskName: 'Arduino Compile',
  uploadTaskName: 'Arduino Upload',
  environmentTemplateFolderName: 'Arduino Task'
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

  abstract name: string;
  abstract id: string;

  constructor(
      context: vscode.ExtensionContext, devicePath: string,
      channel: vscode.OutputChannel, telemetryContext: TelemetryContext,
      deviceType: DeviceType) {
    this.deviceType = deviceType;
    this.componentType = ComponentType.Device;
    this.deviceFolder = devicePath;
    this.extensionContext = context;
    this.vscodeFolderPath =
        path.join(this.deviceFolder, FileNames.vscodeSettingsFolderName);
    this.boardFolderPath = context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName));
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
          'Arduino extension is required for the current project. Do you want to install it from marketplace?',
          'Yes', 'No');
      if (choice === 'Yes') {
        vscode.commands.executeCommand(
            'vscode.open',
            vscode.Uri.parse(
                'vscode:extension/' + DependentExtensions.arduino));
      }
      return false;
    }

    return true;
  }

  async checkPrerequisites(): Promise<boolean> {
    const isArduinoExtensionAvailable = await ArduinoDeviceBase.isAvailable();
    if (!isArduinoExtensionAvailable) {
      return false;
    }

    return true;
  }

  async compile(): Promise<boolean> {
    const result = await this.preCompileAction();
    if (!result) {
      return false;
    }

    const compileTimeScaffoldType = ScaffoldType.Workspace;
    if (!await FileUtility.directoryExists(
            compileTimeScaffoldType, this.deviceFolder)) {
      throw new Error('Unable to find the project folder.');
    }

    // Execute default compilation task to compile device code.
    const tasks = await vscode.tasks.fetchTasks();
    if (!tasks || tasks.length < 1) {
      const message = `Failed to fetch tasks.`;
      utils.channelShowAndAppendLine(this.channel, message);

      await utils.askToConfigureEnvironment(
          this.extensionContext, this.channel, this.telemetryContext,
          PlatformType.Arduino, this.deviceFolder, compileTimeScaffoldType,
          OperationType.Compile);
      return false;
    }

    const arduinoCompileTask = tasks.filter(task => {
      return task.name === constants.compileTaskName;
    });
    if (!arduinoCompileTask || arduinoCompileTask.length < 1) {
      const message = `Failed to fetch default arduino compilation task.`;
      utils.channelShowAndAppendLine(this.channel, message);

      await utils.askToConfigureEnvironment(
          this.extensionContext, this.channel, this.telemetryContext,
          PlatformType.Arduino, this.deviceFolder, compileTimeScaffoldType,
          OperationType.Compile);
      return false;
    }

    try {
      await vscode.tasks.executeTask(arduinoCompileTask[0]);
    } catch (error) {
      throw new Error(`Failed to execute compilation task: ${error.message}`);
    }
    return true;
  }

  async upload(): Promise<boolean> {
    const result = await this.preUploadAction();
    if (!result) {
      return false;
    }

    const uploadTimeScaffoldType = ScaffoldType.Workspace;
    if (!await FileUtility.directoryExists(
            uploadTimeScaffoldType, this.deviceFolder)) {
      throw new Error('Unable to find the project folder.');
    }

    // Execute default upload task to upload device code.
    const tasks = await vscode.tasks.fetchTasks();
    if (!tasks || tasks.length < 1) {
      const message = `Failed to fetch tasks.`;
      utils.channelShowAndAppendLine(this.channel, message);

      await utils.askToConfigureEnvironment(
          this.extensionContext, this.channel, this.telemetryContext,
          PlatformType.Arduino, this.deviceFolder, uploadTimeScaffoldType,
          OperationType.Upload);
      return false;
    }

    const arduinoUploadTask = tasks.filter(task => {
      return task.name === constants.uploadTaskName;
    });
    if (!arduinoUploadTask || arduinoUploadTask.length < 1) {
      const message = `Failed to fetch default arduino upload task.`;
      utils.channelShowAndAppendLine(this.channel, message);

      await utils.askToConfigureEnvironment(
          this.extensionContext, this.channel, this.telemetryContext,
          PlatformType.Arduino, this.deviceFolder, uploadTimeScaffoldType,
          OperationType.Upload);
      return false;
    }

    try {
      await vscode.tasks.executeTask(arduinoUploadTask[0]);
    } catch (error) {
      throw new Error(`Failed to execute upload task: ${error.message}`);
    }

    return true;
  }


  abstract async configDeviceSettings(): Promise<boolean>;

  abstract async load(): Promise<boolean>;


  abstract async create(): Promise<boolean>;

  async createCore(board: Board|undefined, templateFiles: TemplateFileInfo[]):
      Promise<boolean> {
    // Generate template files
    const createTimeScaffoldType = ScaffoldType.Local;
    if (!await FileUtility.directoryExists(
            createTimeScaffoldType, this.deviceFolder)) {
      throw new Error(`Internal error: Couldn't find the template folder.`);
    }
    if (!board) {
      throw new Error(`Invalid / unsupported target platform`);
    }

    const plat = await IoTWorkbenchSettings.getPlatform();

    for (const fileInfo of templateFiles) {
      if (fileInfo.fileName.endsWith('macos.json') ||
          fileInfo.fileName.endsWith('win32.json')) {
        if ((fileInfo.fileName.endsWith('macos.json') && plat === 'darwin') ||
            (fileInfo.fileName.endsWith('win32.json') && plat === 'win32')) {
          await this.generateCppPropertiesFile(
              createTimeScaffoldType, board, fileInfo);
        }
      } else {
        // Copy file directly
        await utils.generateTemplateFile(
            this.deviceFolder, createTimeScaffoldType, fileInfo);
      }
    }

    // Configurate device environment
    const res = await this.configDeviceEnvironment(
        this.deviceFolder, createTimeScaffoldType);

    return res;
  }

  // Backward compatibility: Check configuration
  abstract async preCompileAction(): Promise<boolean>;

  abstract async preUploadAction(): Promise<boolean>;

  abstract get version(): string;

  async generateCppPropertiesFile(
      type: ScaffoldType, board: Board,
      fileInfo: TemplateFileInfo): Promise<void> {
    const targetFolder = path.join(this.deviceFolder, fileInfo.targetPath);
    if (!await FileUtility.directoryExists(type, targetFolder)) {
      await FileUtility.mkdirRecursively(type, targetFolder);
    }

    // Create c_cpp_properties.json file
    const cppPropertiesFilePath =
        path.join(targetFolder, constants.cppPropertiesFileName);

    if (await FileUtility.directoryExists(type, cppPropertiesFilePath)) {
      return;
    }

    try {
      const plat = await IoTWorkbenchSettings.getPlatform();

      if (plat === 'win32') {
        const rootPathPattern = /{ROOTPATH}/g;
        const versionPattern = /{VERSION}/g;
        const homeDir = await IoTWorkbenchSettings.getOs();
        const localAppData: string = path.join(homeDir, 'AppData', 'Local');
        const replaceStr =
            (fileInfo.fileContent as string)
                .replace(rootPathPattern, localAppData.replace(/\\/g, '\\\\'))
                .replace(versionPattern, this.version);
        await FileUtility.writeFile(type, cppPropertiesFilePath, replaceStr);
      }
      // TODO: Let's use the same file for Linux and MacOS for now. Need to
      // revisit this part.
      else {
        const propertiesFilePathMac =
            this.extensionContext.asAbsolutePath(path.join(
                FileNames.resourcesFolderName, board.id,
                constants.cppPropertiesFileNameMac));
        const propertiesContentMac =
            await FileUtility.readFile(type, propertiesFilePathMac).toString();
        await FileUtility.writeFile(
            type, cppPropertiesFilePath, propertiesContentMac);
      }
    } catch (error) {
      throw new Error(`Create cpp properties file failed: ${error.message}`);
    }
  }

  async generateCrc(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel) {
    if (!(vscode.workspace.workspaceFolders &&
          vscode.workspace.workspaceFolders.length > 0)) {
      const message = 'No workspace opened.';
      vscode.window.showWarningMessage(message);
      utils.channelShowAndAppendLine(channel, message);
      return false;
    }

    const devicePath = ConfigHandler.get<string>(ConfigKey.devicePath);
    if (!devicePath) {
      const message = 'No device path found in workspace configuration.';
      vscode.window.showWarningMessage(message);
      utils.channelShowAndAppendLine(channel, message);
      return false;
    }
    const deviceBuildLocation = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath, '..', devicePath,
        '.build');

    if (!deviceBuildLocation) {
      const message = 'No device compile output folder found.';
      vscode.window.showWarningMessage(message);
      utils.channelShowAndAppendLine(channel, message);
      return false;
    }

    const binFiles = fs.listSync(deviceBuildLocation, ['bin']);
    if (!binFiles || !binFiles.length) {
      const message =
          'No bin file found. Please run the command of Device Compile first.';
      vscode.window.showWarningMessage(message);
      utils.channelShowAndAppendLine(channel, message);
      return false;
    }

    let binFilePath = '';

    if (binFiles.length === 1) {
      binFilePath = binFiles[0];
    } else {
      const binFilePickItems: vscode.QuickPickItem[] = [];
      for (const file of binFiles) {
        const fileName = path.basename(file);
        binFilePickItems.push({label: fileName, description: file});
      }

      const choice = await vscode.window.showQuickPick(binFilePickItems, {
        ignoreFocusOut: true,
        matchOnDescription: true,
        matchOnDetail: true,
        placeHolder: 'Select bin file',
      });

      if (!choice || !choice.description) {
        return false;
      }

      binFilePath = choice.description;
    }

    if (!binFilePath || !fs.existsSync(binFilePath)) {
      return false;
    }

    const res = OTA.generateCrc(binFilePath);

    vscode.window.showInformationMessage('Generate CRC succeeded.');

    channel.show();
    channel.appendLine('========== CRC Information ==========');
    channel.appendLine('');
    channel.appendLine('fwPath: ' + binFilePath);
    channel.appendLine('fwPackageCheckValue: ' + res.crc);
    channel.appendLine('fwSize: ' + res.size);
    channel.appendLine('');
    channel.appendLine('======================================');

    return true;
  }

  async configDeviceEnvironment(deviceDir: string, scaffoldType: ScaffoldType):
      Promise<boolean> {
    if (!deviceDir) {
      throw new Error(
          'Unable to find the project device path, please open the folder and initialize project again.');
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

    // Get environment template files
    const projectEnvTemplate: ProjectTemplate[] =
        templateJson.templates.filter((template: ProjectTemplate) => {
          return (
              template.tag === TemplateTag.DevelopmentEnvironment &&
              template.name === constants.environmentTemplateFolderName);
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
          scaffoldType, deviceDir, templateFilesInfo);
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
      await utils.generateTemplateFile(deviceDir, scaffoldType, fileInfo);
    }

    const message = 'Arduino device configuration done.';
    utils.channelShowAndAppendLine(this.channel, message);

    return true;
  }
}