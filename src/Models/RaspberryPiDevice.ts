// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from "path";
import * as vscode from "vscode";
import * as sdk from "vscode-iot-device-cube-sdk";

import { CancelOperationError } from "../common/CancelOperationError";
import { ConfigHandler } from "../configHandler";
import { ConfigKey, FileNames, OperationType, ScaffoldType } from "../constants";
import { FileUtility } from "../FileUtility";
import { TelemetryContext } from "../telemetry";
import { askAndOpenInRemote, channelShowAndAppendLine, executeCommand } from "../utils";

import { ContainerDeviceBase } from "./ContainerDeviceBase";
import { DeviceType } from "./Interfaces/Device";
import { TemplateFileInfo } from "./Interfaces/ProjectTemplate";
import { RemoteExtension } from "./RemoteExtension";

class RaspberryPiUploadConfig {
  static host = "hostname";
  static port = 22;
  static user = "username";
  static password = "password";
  static projectPath = "IoTProject";
  static updated = false;
}

export class RaspberryPiDevice extends ContainerDeviceBase {
  private static _boardId = "raspberrypi";
  name = "Raspberry Pi";

  static get boardId(): string {
    return RaspberryPiDevice._boardId;
  }

  constructor(
    context: vscode.ExtensionContext,
    projectPath: string,
    channel: vscode.OutputChannel,
    telemetryContext: TelemetryContext,
    templateFilesInfo: TemplateFileInfo[] = []
  ) {
    super(context, projectPath, channel, telemetryContext, DeviceType.RaspberryPi, templateFilesInfo);
  }

  private async getBinaryFileName(): Promise<string | undefined> {
    // Parse binary name from CMakeLists.txt file
    const cmakeFilePath = path.join(this.projectFolder, FileNames.cmakeFileName);
    if (!(await FileUtility.fileExists(ScaffoldType.Workspace, cmakeFilePath))) {
      return;
    }
    const getBinaryFileNameCmd = `cat ${cmakeFilePath} | grep 'add_executable' \
    | sed -e 's/^add_executable(//' | awk '{$1=$1};1' | cut -d ' ' -f1 | tr -d '\n'`;

    const binaryName = await executeCommand(getBinaryFileNameCmd);
    return binaryName;
  }

  private async enableBinaryExecutability(ssh: sdk.SSH, binaryName: string): Promise<void> {
    if (!binaryName) {
      return;
    }

    const chmodCmd = `cd ${RaspberryPiUploadConfig.projectPath} && [ -f ${binaryName} ] && chmod +x ${binaryName}`;
    await ssh.exec(chmodCmd);

    return;
  }

  async upload(): Promise<boolean> {
    const isRemote = RemoteExtension.isRemote(this.extensionContext);
    if (!isRemote) {
      await askAndOpenInRemote(OperationType.Upload, this.telemetryContext);
      return false;
    }

    try {
      const binaryName = await this.getBinaryFileName();
      if (!binaryName) {
        const message = `No executable file specified in ${FileNames.cmakeFileName}. \
        Nothing to upload to target machine.`;
        vscode.window.showWarningMessage(message);
        channelShowAndAppendLine(this.channel, message);
        return false;
      }

      const binaryFilePath = path.join(this.outputPath, binaryName);
      if (!(await FileUtility.fileExists(ScaffoldType.Workspace, binaryFilePath))) {
        const message = `Executable file ${binaryName} does not exist under ${this.outputPath}. \
        Please compile device code first.`;
        vscode.window.showWarningMessage(message);
        channelShowAndAppendLine(this.channel, message);
        return false;
      }

      if (!RaspberryPiUploadConfig.updated) {
        const res = await this.configSSH();
        if (!res) {
          throw new CancelOperationError(`Configure SSH cancelled.`);
        }
      }

      const ssh = new sdk.SSH();
      await ssh.open(
        RaspberryPiUploadConfig.host,
        RaspberryPiUploadConfig.port,
        RaspberryPiUploadConfig.user,
        RaspberryPiUploadConfig.password
      );

      try {
        await ssh.uploadFile(binaryFilePath, RaspberryPiUploadConfig.projectPath);
      } catch (error) {
        const message = `SSH traffic is too busy. Please wait a second and retry. Error: ${error}.`;
        channelShowAndAppendLine(this.channel, message);
        console.log(error);
        throw new Error(message);
      }

      try {
        await this.enableBinaryExecutability(ssh, binaryName);
      } catch (error) {
        throw new Error(`Failed to enable binary executability. Error: ${error.message}`);
      }

      try {
        await ssh.close();
      } catch (error) {
        throw new Error(`Failed to close SSH connection. Error: ${error.message}`);
      }

      const message = `Successfully deploy compiled files to device board.`;
      channelShowAndAppendLine(this.channel, message);
      vscode.window.showInformationMessage(message);
    } catch (error) {
      throw new Error(
        `Upload binary file to device ${RaspberryPiUploadConfig.user}@${RaspberryPiUploadConfig.host} failed. ${error}`
      );
    }

    return true;
  }

  async configDeviceSettings(): Promise<boolean> {
    const configSelectionItems: vscode.QuickPickItem[] = [
      {
        label: "Configure SSH to target device",
        description: "",
        detail: "Configure SSH (IP, username and password) connection to target device for uploading compiled code"
      }
    ];

    const configSelection = await vscode.window.showQuickPick(configSelectionItems, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: "Select an option"
    });

    if (!configSelection) {
      return false;
    }

    if (configSelection.label === "Configure SSH to target device") {
      try {
        const res = await this.configSSH();
        if (res) {
          vscode.window.showInformationMessage("Config SSH successfully.");
        }
        return res;
      } catch (error) {
        vscode.window.showWarningMessage("Config SSH failed.");
        return false;
      }
    } else {
      try {
        const res = await this.configHub();
        return res;
      } catch (error) {
        vscode.window.showWarningMessage("Config IoT Hub failed.");
        return false;
      }
    }
  }

  private async autoDiscoverDeviceIp(): Promise<vscode.QuickPickItem[]> {
    const sshDevicePickItems: vscode.QuickPickItem[] = [];
    const deviceInfos = await sdk.SSH.discover();
    deviceInfos.forEach(deviceInfo => {
      sshDevicePickItems.push({
        label: deviceInfo.ip as string,
        description: deviceInfo.host || "<Unknown>"
      });
    });

    sshDevicePickItems.push(
      {
        label: "$(sync) Discover again",
        detail: "Auto discover SSH enabled device in LAN"
      },
      {
        label: "$(gear) Manual setup",
        detail: "Setup device SSH configuration manually"
      }
    );

    return sshDevicePickItems;
  }

  async configSSH(): Promise<boolean> {
    // Raspberry Pi host
    const sshDiscoverOrInputItems: vscode.QuickPickItem[] = [
      {
        label: "$(search) Auto discover",
        detail: "Auto discover SSH enabled device in LAN"
      },
      {
        label: "$(gear) Manual setup",
        detail: "Setup device SSH configuration manually"
      }
    ];
    const sshDiscoverOrInputChoice = await vscode.window.showQuickPick(sshDiscoverOrInputItems, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: "Select an option"
    });
    if (!sshDiscoverOrInputChoice) {
      return false;
    }

    let raspiHost: string | undefined;

    if (sshDiscoverOrInputChoice.label === "$(search) Auto discover") {
      let selectDeviceChoice: vscode.QuickPickItem | undefined;
      do {
        const selectDeviceItems = this.autoDiscoverDeviceIp();
        selectDeviceChoice = await vscode.window.showQuickPick(selectDeviceItems, {
          ignoreFocusOut: true,
          matchOnDescription: true,
          matchOnDetail: true,
          placeHolder: "Select a device"
        });
      } while (selectDeviceChoice && selectDeviceChoice.label === "$(sync) Discover again");

      if (!selectDeviceChoice) {
        return false;
      }

      if (selectDeviceChoice.label !== "$(gear) Manual setup") {
        raspiHost = selectDeviceChoice.label;
      }
    }

    if (!raspiHost) {
      const raspiHostOption: vscode.InputBoxOptions = {
        value: RaspberryPiUploadConfig.host,
        prompt: `Please input device ip or hostname here.`,
        ignoreFocusOut: true
      };
      raspiHost = await vscode.window.showInputBox(raspiHostOption);
      if (!raspiHost) {
        return false;
      }
    }
    raspiHost = raspiHost || RaspberryPiUploadConfig.host;

    // Raspberry Pi SSH port
    const raspiPortOption: vscode.InputBoxOptions = {
      value: RaspberryPiUploadConfig.port.toString(),
      prompt: `Please input SSH port here.`,
      ignoreFocusOut: true
    };
    const raspiPortString = await vscode.window.showInputBox(raspiPortOption);
    if (!raspiPortString) {
      return false;
    }
    const raspiPort =
      raspiPortString && !isNaN(Number(raspiPortString)) ? Number(raspiPortString) : RaspberryPiUploadConfig.port;

    // Raspberry Pi user name
    const raspiUserOption: vscode.InputBoxOptions = {
      value: RaspberryPiUploadConfig.user,
      prompt: `Please input user name here.`,
      ignoreFocusOut: true
    };
    let raspiUser = await vscode.window.showInputBox(raspiUserOption);
    if (!raspiUser) {
      return false;
    }
    raspiUser = raspiUser || RaspberryPiUploadConfig.user;

    // Raspberry Pi user password
    const raspiPasswordOption: vscode.InputBoxOptions = {
      value: RaspberryPiUploadConfig.password,
      prompt: `Please input password here.`,
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
      prompt: `Please input project destination path here.`,
      ignoreFocusOut: true
    };
    let raspiPath = await vscode.window.showInputBox(raspiPathOption);
    if (!raspiPath) {
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

    if (!FileUtility.directoryExists(ScaffoldType.Workspace, projectFolderPath)) {
      throw new Error("Unable to find the device folder inside the project.");
    }

    const deviceConnectionStringSelection: vscode.QuickPickItem[] = [
      {
        label: "Copy device connection string",
        description: "Copy device connection string",
        detail: "Copy"
      }
    ];
    const selection = await vscode.window.showQuickPick(deviceConnectionStringSelection, {
      ignoreFocusOut: true,
      placeHolder: "Copy IoT Hub Device Connection String"
    });

    if (!selection) {
      return false;
    }

    const deviceConnectionString = ConfigHandler.get<string>(ConfigKey.iotHubDeviceConnectionString);
    if (!deviceConnectionString) {
      throw new Error(
        "Unable to get the device connection string, please invoke the command of Azure Provision first."
      );
    }
    const ssh = new sdk.SSH();
    await ssh.clipboardCopy(deviceConnectionString);
    await ssh.close();
    vscode.window.showInformationMessage("Device connection string has been copied.");
    return true;
  }
}
