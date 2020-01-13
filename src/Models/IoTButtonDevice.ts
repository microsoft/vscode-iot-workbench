// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from "fs-plus";
import { Guid } from "guid-typescript";
import * as path from "path";
import * as request from "request-promise";
import * as vscode from "vscode";

import { ResourceNotFoundError } from "../common/Error/OperationFailedErrors/ResourceNotFoundError";
import { OperationCanceledError } from "../common/Error/OperationCanceledError";
import { OperationFailedError } from "../common/Error/OperationFailedErrors/OperationFailedError";
import { ArgumentInvalidError } from "../common/Error/OperationFailedErrors/ArgumentInvalidError";
import { ConfigHandler } from "../configHandler";
import { ConfigKey, ScaffoldType } from "../constants";
import { FileUtility } from "../FileUtility";
import { generateTemplateFile } from "../utils";

import { ComponentType } from "./Interfaces/Component";
import { Device, DeviceType } from "./Interfaces/Device";
import { TemplateFileInfo } from "./Interfaces/ProjectTemplate";
const constants = {
  timeout: 10000,
  accessEndpoint: "http://192.168.4.1",
  userjsonFilename: "userdata.json"
};

export class IoTButtonDevice implements Device {
  private deviceType: DeviceType;
  private componentType: ComponentType;
  private deviceFolder: string;

  private componentId: string;
  get id(): string {
    return this.componentId;
  }

  private static _boardId = "iotbutton";

  static get boardId(): string {
    return IoTButtonDevice._boardId;
  }

  constructor(devicePath: string, private templateFilesInfo: TemplateFileInfo[] = []) {
    this.deviceType = DeviceType.IoTButton;
    this.componentType = ComponentType.Device;
    this.deviceFolder = devicePath;
    this.componentId = Guid.create().toString();
  }

  name = "IoTButton";

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
    const loadTimeScaffoldType = ScaffoldType.Workspace;
    this.validateDeviceFolder(loadTimeScaffoldType);
  }

  async create(): Promise<void> {
    const createTimeScaffoldType = ScaffoldType.Local;
    if (!(await FileUtility.directoryExists(createTimeScaffoldType, this.deviceFolder))) {
      throw new ResourceNotFoundError(`device folder ${this.deviceFolder}`, "Please initialize the device first.");
    }

    for (const fileInfo of this.templateFilesInfo) {
      await generateTemplateFile(this.deviceFolder, createTimeScaffoldType, fileInfo);
    }
  }

  async compile(): Promise<boolean> {
    vscode.window.showInformationMessage("Congratulations! There is no device code to compile in this project.");
    return true;
  }

  async upload(): Promise<boolean> {
    vscode.window.showInformationMessage("Congratulations! There is no device code to upload in this project.");
    return true;
  }

  async configDeviceSettings(): Promise<void> {
    // TODO: try to connect to access point host of IoT button to detect the
    // connection.
    const configSelectionItems: vscode.QuickPickItem[] = [
      {
        label: "Config WiFi of IoT button",
        description: "Config WiFi of IoT button",
        detail: "Config WiFi"
      },
      {
        label: "Config connection of IoT Hub Device",
        description: "Config connection of IoT Hub Device",
        detail: "Config IoT Hub Device"
      },
      {
        label: "Config time server of IoT button",
        description: "Config time server of IoT button",
        detail: "Config Time Server"
      },
      {
        label: "Config JSON data to append to message",
        description: "Config JSON data to append to message",
        detail: "Config User Json Data"
      },
      {
        label: "Shutdown IoT button",
        description: "Shutdown IoT button",
        detail: "Shutdown"
      }
    ];

    const configSelection = await vscode.window.showQuickPick(configSelectionItems, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: "Select an option"
    });

    if (!configSelection) {
      throw new OperationCanceledError("IoT Button device setting type selection cancelled.");
    }

    if (configSelection.detail === "Config WiFi") {
      try {
        const res = await this.configWifi();
        if (res) {
          vscode.window.showInformationMessage("Config WiFi successfully.");
        }
      } catch (error) {
        vscode.window.showWarningMessage("Config WiFi failed.");
      }
    } else if (configSelection.detail === "Config IoT Hub Device") {
      try {
        const res = await this.configHub();
        if (res) {
          vscode.window.showInformationMessage("Config Azure IoT Hub successfully.");
        }
      } catch (error) {
        vscode.window.showWarningMessage("Config IoT Hub failed.");
      }
    } else if (configSelection.detail === "Config Time Server") {
      try {
        const res = await this.configNtp();
        if (res) {
          vscode.window.showInformationMessage("Config time server successfully.");
        }
      } catch (error) {
        vscode.window.showWarningMessage("Config IoT Hub failed.");
      }
    } else if (configSelection.detail === "Config User Json Data") {
      try {
        const res = await this.configUserData();
        if (res) {
          vscode.window.showInformationMessage("Config user data successfully.");
        }
      } catch (error) {
        vscode.window.showWarningMessage("Config user data failed.");
      }
    } else {
      try {
        await this.configSaveAndShutdown();
      } catch (error) {
        // Ignore.
        // Because the button has been shutdown, we won't get any response for
        // the action
      }

      vscode.window.showInformationMessage("Shutdown IoT button completed.");
      return;
    }

    return await this.configDeviceSettings();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async setConfig(uri: string, data: {}): Promise<any> {
    const option = {
      uri,
      method: "POST",
      timeout: constants.timeout,
      form: data
    };

    const res = await request(option);

    if (!res) {
      throw new OperationFailedError("Empty response.");
    }

    return res;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async configWifi(): Promise<any> {
    const ssid = await vscode.window.showInputBox({
      prompt: `WiFi SSID`,
      ignoreFocusOut: true,
      validateInput: (ssid: string) => {
        if (!ssid) {
          return "WiFi SSID cannot be empty.";
        } else {
          return;
        }
      }
    });

    if (!ssid) {
      return false;
    }

    const password = await vscode.window.showInputBox({
      prompt: `WiFi Password`,
      password: true,
      ignoreFocusOut: true
    });

    if (!password) {
      return false;
    }

    const data = { ssid, password };
    const uri = constants.accessEndpoint;

    const res = await this.setConfig(uri, data);

    return res;
  }

  async configHub(): Promise<boolean> {
    let deviceConnectionString = ConfigHandler.get<string>(ConfigKey.iotHubDeviceConnectionString);

    let hostName = "";
    let deviceId = "";
    if (deviceConnectionString) {
      const hostnameMatches = deviceConnectionString.match(/HostName=(.*?)(;|$)/);
      if (hostnameMatches) {
        hostName = hostnameMatches[0];
      }

      const deviceIDMatches = deviceConnectionString.match(/DeviceId=(.*?)(;|$)/);
      if (deviceIDMatches) {
        deviceId = deviceIDMatches[0];
      }
    }

    let deviceConnectionStringSelection: vscode.QuickPickItem[] = [];
    if (deviceId && hostName) {
      deviceConnectionStringSelection = [
        {
          label: "Select IoT Hub Device Connection String",
          description: "",
          detail: `Device Information: ${hostName} ${deviceId}`
        },
        {
          label: "Input IoT Hub Device Connection String",
          description: "",
          detail: "Input another..."
        }
      ];
    } else {
      deviceConnectionStringSelection = [
        {
          label: "Input IoT Hub Device Connection String",
          description: "",
          detail: "Input another..."
        }
      ];
    }

    const selection = await vscode.window.showQuickPick(deviceConnectionStringSelection, {
      ignoreFocusOut: true,
      placeHolder: "Choose IoT Hub Device Connection String"
    });

    if (!selection) {
      return false;
    }

    if (selection.detail === "Input another...") {
      const option: vscode.InputBoxOptions = {
        value: "HostName=<Host Name>;DeviceId=<Device Name>;SharedAccessKey=<Device Key>",
        prompt: `Please input device connection string here.`,
        ignoreFocusOut: true,
        validateInput: (connectionString: string) => {
          if (!connectionString) {
            return "Connection string cannot be empty.";
          } else {
            return;
          }
        }
      };

      deviceConnectionString = await vscode.window.showInputBox(option);
      if (!deviceConnectionString) {
        return false;
      }

      if (
        deviceConnectionString.indexOf("HostName") === -1 ||
        deviceConnectionString.indexOf("DeviceId") === -1 ||
        deviceConnectionString.indexOf("SharedAccessKey") === -1
      ) {
        throw new ArgumentInvalidError(
          "The format of IoT Hub Device connection string",
          "Please provide a valid Device connection string."
        );
      }
    }

    if (!deviceConnectionString) {
      return false;
    }

    console.log(deviceConnectionString);

    const iothubMatches = deviceConnectionString.match(/HostName=(.*?)(;|$)/);
    const iotdevicenameMatches = deviceConnectionString.match(/DeviceId=(.*?)(;|$)/);
    const iotdevicesecretMatches = deviceConnectionString.match(/SharedAccessKey=(.*?)(;|$)/);
    if (
      !iothubMatches ||
      !iothubMatches[1] ||
      !iotdevicenameMatches ||
      !iotdevicenameMatches[1] ||
      !iotdevicesecretMatches ||
      !iotdevicesecretMatches[1]
    ) {
      return false;
    }

    const iothub = iothubMatches[1];
    const iotdevicename = iotdevicenameMatches[1];
    const iotdevicesecret = iotdevicesecretMatches[1];

    const data = { iothub, iotdevicename, iotdevicesecret };
    const uri = constants.accessEndpoint;

    const res = await this.setConfig(uri, data);

    return res;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async configUserData(): Promise<any> {
    if (!fs.existsSync(this.deviceFolder)) {
      throw new ResourceNotFoundError("config user data", `device folder ${this.deviceFolder}`);
    }

    const userjsonFilePath = path.join(this.deviceFolder, constants.userjsonFilename);

    if (!fs.existsSync(userjsonFilePath)) {
      throw new ResourceNotFoundError("config user data", `user json file ${userjsonFilePath}`);
    }

    let userjson = {};

    try {
      userjson = JSON.parse(fs.readFileSync(userjsonFilePath, "utf8"));
    } catch (error) {
      userjson = {};
    }

    const data = { userjson: JSON.stringify(userjson) };
    const uri = constants.accessEndpoint;

    const res = await this.setConfig(uri, data);

    return res;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async configNtp(): Promise<any> {
    const timeserver = await vscode.window.showInputBox({
      value: "pool.ntp.org",
      prompt: `Time Server`,
      ignoreFocusOut: true,
      validateInput: (timeserver: string) => {
        if (!timeserver) {
          return "Time Server cannot be empty.";
        } else {
          return;
        }
      }
    });

    if (!timeserver) {
      return false;
    }

    const data = { timeserver };
    const uri = constants.accessEndpoint;

    const res = await this.setConfig(uri, data);

    return res;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async configSaveAndShutdown(): Promise<any> {
    const data = { action: "shutdown" };
    const uri = constants.accessEndpoint;

    const res = await this.setConfig(uri, data);

    return res;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async configDeviceEnvironment(_deviceRootPath: string, _scaffoldType: ScaffoldType): Promise<void> {
    // Do nothing.
  }

  /**
   * Validate whether device folder exists. If not, throw error.
   * @param scaffoldType scaffold type
   */
  async validateDeviceFolder(scaffoldType: ScaffoldType): Promise<void> {
    if (!(await FileUtility.directoryExists(scaffoldType, this.deviceFolder))) {
      throw new ResourceNotFoundError(
        `device folder path ${this.deviceFolder}`,
        "Please initialize the project first."
      );
    }
  }
}
