// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as clipboardy from "clipboardy";
import * as fs from "fs-plus";
import { Guid } from "guid-typescript";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

import { BoardProvider } from "../boardProvider";
import { ConfigHandler } from "../configHandler";
import { ConfigKey, OSPlatform } from "../constants";
import { TelemetryContext } from "../telemetry";

import { ArduinoDeviceBase } from "./ArduinoDeviceBase";
import { DeviceType } from "./Interfaces/Device";
import { TemplateFileInfo } from "./Interfaces/ProjectTemplate";
import { Board } from "./Interfaces/Board";
import { OperationCanceledError } from "../common/Error/InternalError";

enum ConfigDeviceSettings {
  Copy = 'Copy',
  ConfigCRC = 'Config CRC'
}

export class Esp32Device extends ArduinoDeviceBase {
  private templateFiles: TemplateFileInfo[] = [];
  private static _boardId = "esp32";

  private componentId: string;
  get id(): string {
    return this.componentId;
  }

  static get boardId(): string {
    return Esp32Device._boardId;
  }

  get board(): Board | undefined {
    const boardProvider = new BoardProvider(this.boardFolderPath);
    const esp32 = boardProvider.find({ id: Esp32Device._boardId });
    return esp32;
  }

  get version(): string {
    const platform = os.platform();
    let packageRootPath = "";
    let version = "0.0.1";

    if (platform === OSPlatform.WIN32) {
      const homeDir = os.homedir();
      const localAppData: string = path.join(homeDir, "AppData", "Local");
      packageRootPath = path.join(localAppData, "Arduino15", "packages", "esp32", "hardware", "esp32");
    } else {
      packageRootPath = "~/Library/Arduino15/packages/esp32/hardware/esp32";
    }

    if (fs.existsSync(packageRootPath)) {
      const versions = fs.readdirSync(packageRootPath);
      if (versions[0]) {
        version = versions[0];
      }
    }

    return version;
  }

  name = "Esp32Arduino";

  constructor(
    context: vscode.ExtensionContext,
    channel: vscode.OutputChannel,
    telemetryContext: TelemetryContext,
    devicePath: string,
    templateFiles?: TemplateFileInfo[]
  ) {
    super(context, devicePath, channel, telemetryContext, DeviceType.IoTButton);
    this.channel = channel;
    this.componentId = Guid.create().toString();
    if (templateFiles) {
      this.templateFiles = templateFiles;
    }
  }

  async checkPrerequisites(): Promise<boolean> {
    return super.checkPrerequisites();
  }

  async create(): Promise<void> {
    this.createCore(this.board, this.templateFiles);
  }

  async configDeviceSettings(): Promise<void> {
    const configSelectionItems: vscode.QuickPickItem[] = [
      {
        label: 'Copy device connection string',
        description: 'Copy device connection string',
        detail: ConfigDeviceSettings.Copy
      },
      {
        label: 'Generate CRC for OTA',
        description:
            'Generate Cyclic Redundancy Check(CRC) code for OTA Update',
        detail: ConfigDeviceSettings.ConfigCRC
      }
    ];

    const configSelection = await vscode.window.showQuickPick(configSelectionItems, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: "Select an option"
    });

    if (!configSelection) {
      throw new OperationCanceledError(
          'ESP32 device setting type selection cancelled.');
    }

    if (configSelection.detail === ConfigDeviceSettings.ConfigCRC) {
      await this.generateCrc(this.channel);
    } else if (configSelection.detail === ConfigDeviceSettings.Copy) {
      const deviceConnectionString =
          ConfigHandler.get<string>(ConfigKey.iotHubDeviceConnectionString);

      if (!deviceConnectionString) {
        throw new Error(
          "Unable to get the device connection string, please invoke the command of Azure Provision first."
        );
      }
      clipboardy.writeSync(deviceConnectionString);
      return;
    } else {
      throw new Error(
          `Unsupported configuration type: ${configSelection.detail}.`);
    }
  }

  async preCompileAction(): Promise<boolean> {
    return true;
  }

  async preUploadAction(): Promise<boolean> {
    return true;
  }
}
