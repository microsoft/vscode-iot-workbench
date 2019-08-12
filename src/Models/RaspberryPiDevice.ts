// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as vscode from 'vscode';
import * as sdk from 'vscode-iot-device-cube-sdk';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, OperationType, ScaffoldType} from '../constants';
import {FileUtility} from '../FileUtility';
import {TelemetryContext} from '../telemetry';
import {askAndOpenInRemote, channelShowAndAppendLine} from '../utils';

import {ContainerDeviceBase} from './ContainerDeviceBase';
import {DeviceType} from './Interfaces/Device';
import {TemplateFileInfo} from './Interfaces/ProjectTemplate';
import {RemoteExtension} from './RemoteExtension';

class RaspberryPiUploadConfig {
  static host = 'raspberrypi';
  static port = 22;
  static user = 'pi';
  static password = 'raspberry';
  static projectPath = 'IoTProject';
  static updated = false;
}

export class RaspberryPiDevice extends ContainerDeviceBase {
  private static _boardId = 'raspberrypi';
  name = 'Raspberry Pi';

  static get boardId() {
    return RaspberryPiDevice._boardId;
  }

  constructor(
      context: vscode.ExtensionContext, projectPath: string,
      channel: vscode.OutputChannel, telemetryContext: TelemetryContext,
      templateFilesInfo: TemplateFileInfo[] = []) {
    super(
        context, projectPath, channel, telemetryContext,
        DeviceType.Raspberry_Pi, templateFilesInfo);
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
        const command = ssh.spawn(enableExecPriorityCommand);
        command.on('data', async (data) => {});
        command.on('close', async () => {
          channelShowAndAppendLine(this.channel, 'DONE');
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
      channelShowAndAppendLine(this.channel, message);
      await vscode.window.showInformationMessage(message);
    } catch (error) {
      throw new Error(`Upload device code failed. ${error.message}`);
    }

    return true;
  }

  async compile(): Promise<boolean> {
    const res = super.compile();
    if (res) {
      const message = `Successfully compile ${
          this.name} device code. \rNow you can use the command 'Azure IoT Device Workbench: Upload Device Code' to upload your compiled executable file to your target device.`;
      channelShowAndAppendLine(this.channel, message);
      vscode.window.showInformationMessage(message);
    }

    return res;
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

  private async autoDiscoverDeviceIp(): Promise<vscode.QuickPickItem[]> {
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
        const selectDeviceItems = this.autoDiscoverDeviceIp();
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
  }
}