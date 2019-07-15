// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {Guid} from 'guid-typescript';
import * as path from 'path';
import * as vscode from 'vscode';
import * as sdk from 'vscode-iot-device-cube-sdk';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, FileNames, OperationType, ScaffoldType} from '../constants';
import {FileUtility} from '../FileUtility';
import {TelemetryContext} from '../telemetry';
import {askAndOpenInRemote, generateTemplateFile, runCommand} from '../utils';

import {ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';
import {ProjectTemplateType, TemplateFileInfo} from './Interfaces/ProjectTemplate';
import {IoTWorkbenchProjectBase} from './IoTWorkbenchProjectBase';
import {RemoteExtension} from './RemoteExtension';

const constants = {
  configFile: 'config.json',
};

interface Config {
  applicationName: string;
  buildCommand: string;
  buildTarget: string;
}



class RaspberryPiUploadConfig {
  static host = 'raspberrypi';
  static port = 22;
  static user = 'pi';
  static password = 'raspberry';
  static projectPath = 'IoTProject';
  static updated = false;
}

export class RaspberryPiDevice implements Device {
  private componentId: string;
  get id() {
    return this.componentId;
  }
  private deviceType: DeviceType;
  private componentType: ComponentType;
  private projectFolder: string;
  private channel: vscode.OutputChannel;
  private static _boardId = 'raspberrypi';
  private extensionContext: vscode.ExtensionContext;
  private telemetryContext: TelemetryContext;

  private outputPath: string;

  static get boardId() {
    return RaspberryPiDevice._boardId;
  }

  constructor(
      context: vscode.ExtensionContext, projectPath: string,
      channel: vscode.OutputChannel, projectTemplateType: ProjectTemplateType,
      telemetryContext: TelemetryContext,
      private templateFilesInfo: TemplateFileInfo[] = []) {
    this.deviceType = DeviceType.Raspberry_Pi;
    this.componentType = ComponentType.Device;
    this.channel = channel;
    this.componentId = Guid.create().toString();
    this.extensionContext = context;
    this.projectFolder = projectPath;
    this.outputPath = path.join(this.projectFolder, FileNames.outputPathName);
    this.telemetryContext = telemetryContext;
  }

  name = 'RaspberryPi';

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

    await IoTWorkbenchProjectBase.generateIotWorkbenchProjectFile(
        scaffoldType, this.projectFolder);

    return true;
  }

  async create(): Promise<boolean> {
    // ScaffoldType is local when creating a project
    const scaffoldType = ScaffoldType.Local;
    if (!await FileUtility.directoryExists(scaffoldType, this.projectFolder)) {
      throw new Error('Unable to find the project folder.');
    }

    await IoTWorkbenchProjectBase.generateIotWorkbenchProjectFile(
        scaffoldType, this.projectFolder);
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

    // load project config
    const configPath = path.join(
        this.projectFolder, FileNames.vscodeSettingsFolderName,
        constants.configFile);
    if (!await FileUtility.fileExists(ScaffoldType.Workspace, configPath)) {
      const message = `Config file does not exist. Please check your settings.`;
      await vscode.window.showWarningMessage(message);
      return false;
    }

    const fileContent =
        await FileUtility.readFile(ScaffoldType.Workspace, configPath);
    const config: Config = JSON.parse(fileContent as string);

    this.channel.show();
    this.channel.appendLine('Compiling Raspberry Pi device code...');
    try {
      await runCommand(
          config.buildCommand, [], this.projectFolder, this.channel);
    } catch (error) {
      throw new Error(
          `Failed to compile Raspberry Pi device code. Error message: ${
              error.message}`);
    }

    // If successfully compiled, copy compiled files to user workspace
    if (await FileUtility.directoryExists(
            ScaffoldType.Workspace, config.buildTarget)) {
      const getOutputFileCmd =
          `cp -rf ${config.buildTarget} ${this.outputPath}`;
      try {
        await runCommand(getOutputFileCmd, [], '', this.channel);
      } catch (error) {
        throw new Error(`Failed to copy compiled files to output folder ${
            this.outputPath}. Error message: ${error.message}`);
      }
    } else {
      this.channel.show();
      this.channel.appendLine(
          'Bin files not found. Compilation may have failed.');
      return false;
    }

    const message =
        `Successfully compile Raspberry Pi device code. \rNow you can use the command 'Azure IoT Device Workbench: Upload Device Code' to upload your compiled executable file to your target device.`;
    this.channel.show();
    this.channel.appendLine(message);
    vscode.window.showInformationMessage(message);

    return true;
  }

  async upload(): Promise<boolean> {
    const isRemote = RemoteExtension.isRemote(this.extensionContext);
    if (!isRemote) {
      const res = await askAndOpenInRemote(
          OperationType.Upload, this.channel, this.telemetryContext);
      if (!res) {
        return false;
      }
    }

    try {
      const binFilePath =
          path.join(this.outputPath, 'iot_application/azure_iot_app');

      if (!await FileUtility.fileExists(ScaffoldType.Workspace, binFilePath)) {
        const message =
            `Binary file does not exist. Please compile device code first.`;
        await vscode.window.showWarningMessage(message);
        return false;
      }

      if (!RaspberryPiUploadConfig.updated) {
        const res = await this.configSSH();
        if (!res) {
          vscode.window.showWarningMessage('Configure SSH cancelled.');
          return true;
        }
      }

      const ssh = new sdk.SSH();
      await ssh.open(
          RaspberryPiUploadConfig.host, RaspberryPiUploadConfig.port,
          RaspberryPiUploadConfig.user, RaspberryPiUploadConfig.password);
      try {
        await ssh.uploadFile(binFilePath, RaspberryPiUploadConfig.projectPath);
        const enableExecPriorityCommand =
            `cd ${RaspberryPiUploadConfig.projectPath} && chmod -R 755 .\/`;
        this.channel.show();
        const command = ssh.spawn(enableExecPriorityCommand);
        command.on('data', async (data) => {});
        command.on('close', async () => {
          this.channel.appendLine('DONE');
          await ssh.close();
        });
        command.on('error', this.channel.appendLine);
      } catch (error) {
        throw new Error(
            `Deploy binary file to device ${RaspberryPiUploadConfig.user}@${
                RaspberryPiUploadConfig.host} failed. ${error.message}`);
      }

      // await ssh.close();

      const message = `Successfully deploy bin file to Raspberry Pi board.`;
      this.channel.show();
      this.channel.appendLine(message);
      await vscode.window.showInformationMessage(message);
    } catch (error) {
      throw new Error(`Upload device code failed. ${error.message}`);
    }

    return true;
  }

  async configDeviceSettings(): Promise<boolean> {
    const configSelectionItems: vscode.QuickPickItem[] = [{
      label: 'Configure SSH to target device',
      description: '',
      detail:
          'Configure SSH (IP, username and password) connection to target device for uploading compiled code'
    }];

    const configSelection =
        await vscode.window.showQuickPick(configSelectionItems, {
          ignoreFocusOut: true,
          matchOnDescription: true,
          matchOnDetail: true,
          placeHolder: 'Select an option',
        });

    if (!configSelection) {
      return false;
    }

    if (configSelection.label === 'Configure SSH to target device') {
      try {
        const res = await this.configSSH();
        if (res) {
          vscode.window.showInformationMessage('Config SSH successfully.');
        }
        return res;
      } catch (error) {
        vscode.window.showWarningMessage('Config SSH failed.');
        return false;
      }
    } else {
      try {
        const res = await this.configHub();
        return res;
      } catch (error) {
        vscode.window.showWarningMessage('Config IoT Hub failed.');
        return false;
      }
    }
  }

  async _autoDiscoverDeviceIp(): Promise<vscode.QuickPickItem[]> {
    const sshDevicePickItems: vscode.QuickPickItem[] = [];
    const deviceInfos = await sdk.SSH.discover();
    deviceInfos.forEach((deviceInfo) => {
      sshDevicePickItems.push({
        label: deviceInfo.ip as string,
        description: deviceInfo.host || '<Unknown>'
      });
    });

    sshDevicePickItems.push(
        {
          label: '$(sync) Discover again',
          detail: 'Auto discover SSH enabled device in LAN'
        },
        {
          label: '$(gear) Manual setup',
          detail: 'Setup device SSH configuration manually'
        });

    return sshDevicePickItems;
  }

  async configSSH(): Promise<boolean> {
    // Raspberry Pi host
    const sshDiscoverOrInputItems: vscode.QuickPickItem[] = [
      {
        label: '$(search) Auto discover',
        detail: 'Auto discover SSH enabled device in LAN'
      },
      {
        label: '$(gear) Manual setup',
        detail: 'Setup device SSH configuration manually'
      }
    ];
    const sshDiscoverOrInputChoice =
        await vscode.window.showQuickPick(sshDiscoverOrInputItems, {
          ignoreFocusOut: true,
          matchOnDescription: true,
          matchOnDetail: true,
          placeHolder: 'Select an option',
        });
    if (!sshDiscoverOrInputChoice) {
      return false;
    }

    let raspiHost: string|undefined;

    if (sshDiscoverOrInputChoice.label === '$(search) Auto discover') {
      let selectDeviceChoice: vscode.QuickPickItem|undefined;
      do {
        const selectDeviceItems = this._autoDiscoverDeviceIp();
        selectDeviceChoice =
            await vscode.window.showQuickPick(selectDeviceItems, {
              ignoreFocusOut: true,
              matchOnDescription: true,
              matchOnDetail: true,
              placeHolder: 'Select a device',
            });
      } while (selectDeviceChoice &&
               selectDeviceChoice.label === '$(sync) Discover again');

      if (!selectDeviceChoice) {
        return false;
      }

      if (selectDeviceChoice.label !== '$(gear) Manual setup') {
        raspiHost = selectDeviceChoice.label;
      }
    }

    if (!raspiHost) {
      const raspiHostOption: vscode.InputBoxOptions = {
        value: RaspberryPiUploadConfig.host,
        prompt: `Please input Raspberry Pi device ip or hostname here.`,
        ignoreFocusOut: true
      };
      raspiHost = await vscode.window.showInputBox(raspiHostOption);
      if (raspiHost === undefined) {
        return false;
      }
    }
    raspiHost = raspiHost || RaspberryPiUploadConfig.host;

    // Raspberry Pi SSH port
    const raspiPortOption: vscode.InputBoxOptions = {
      value: RaspberryPiUploadConfig.port.toString(),
      prompt: `Please input Raspberry Pi SSH port here.`,
      ignoreFocusOut: true
    };
    const raspiPortString = await vscode.window.showInputBox(raspiPortOption);
    if (raspiPortString === undefined) {
      return false;
    }
    const raspiPort = raspiPortString && !isNaN(Number(raspiPortString)) ?
        Number(raspiPortString) :
        RaspberryPiUploadConfig.port;

    // Raspberry Pi user name
    const raspiUserOption: vscode.InputBoxOptions = {
      value: RaspberryPiUploadConfig.user,
      prompt: `Please input Raspberry Pi user name here.`,
      ignoreFocusOut: true
    };
    let raspiUser = await vscode.window.showInputBox(raspiUserOption);
    if (raspiUser === undefined) {
      return false;
    }
    raspiUser = raspiUser || RaspberryPiUploadConfig.user;

    // Raspberry Pi user password
    const raspiPasswordOption: vscode.InputBoxOptions = {
      value: RaspberryPiUploadConfig.password,
      prompt: `Please input Raspberry Pi password here.`,
      ignoreFocusOut: true
    };
    let raspiPassword = await vscode.window.showInputBox(raspiPasswordOption);
    if (raspiPassword === undefined) {
      return false;
    }
    raspiPassword = raspiPassword || RaspberryPiUploadConfig.password;

    // Raspberry Pi path
    const raspiPathOption: vscode.InputBoxOptions = {
      value: RaspberryPiUploadConfig.projectPath,
      prompt: `Please input Raspberry Pi path here.`,
      ignoreFocusOut: true
    };
    let raspiPath = await vscode.window.showInputBox(raspiPathOption);
    if (raspiPath === undefined) {
      return false;
    }
    raspiPath = raspiPath || RaspberryPiUploadConfig.projectPath;

    RaspberryPiUploadConfig.host = raspiHost;
    RaspberryPiUploadConfig.port = raspiPort;
    RaspberryPiUploadConfig.user = raspiUser;
    RaspberryPiUploadConfig.password = raspiPassword;
    RaspberryPiUploadConfig.projectPath = raspiPath;
    RaspberryPiUploadConfig.updated = true;
    return true;
  }

  async configHub(): Promise<boolean> {
    try {
      const projectFolderPath = this.projectFolder;

      if (!FileUtility.directoryExists(
              ScaffoldType.Workspace, projectFolderPath)) {
        throw new Error('Unable to find the device folder inside the project.');
      }

      const deviceConnectionStringSelection: vscode.QuickPickItem[] = [{
        label: 'Copy device connection string',
        description: 'Copy device connection string',
        detail: 'Copy'
      }];
      const selection =
          await vscode.window.showQuickPick(deviceConnectionStringSelection, {
            ignoreFocusOut: true,
            placeHolder: 'Copy IoT Hub Device Connection String'
          });

      if (!selection) {
        return false;
      }

      const deviceConnectionString =
          ConfigHandler.get<string>(ConfigKey.iotHubDeviceConnectionString);
      if (!deviceConnectionString) {
        throw new Error(
            'Unable to get the device connection string, please invoke the command of Azure Provision first.');
      }
      await sdk.Clipboard.copy(deviceConnectionString);
      vscode.window.showInformationMessage(
          'Device connection string has been copied.');
      return true;
    } catch (error) {
      throw error;
    }
  }
}