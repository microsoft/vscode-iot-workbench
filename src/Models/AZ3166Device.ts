// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as crypto from "crypto";
import * as fs from "fs-plus";
import * as getmac from "getmac";
import { Guid } from "guid-typescript";
import * as _ from "lodash";
import * as opn from "opn";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import * as WinReg from "winreg";

import { BoardProvider } from "../boardProvider";
import { ArduinoCommands } from "../common/Commands";
import { TypeNotSupportedError } from "../common/Error/SystemErrors/TypeNotSupportedError";
import { ResourceNotFoundError } from "../common/Error/OperationFailedErrors/ResourceNotFoundError";
import { OperationCanceledError } from "../common/Error/OperationCanceledError";
import { OperationFailedError } from "../common/Error/OperationFailedErrors/OperationFailedError";
import { FileNames, OSPlatform, ScaffoldType } from "../constants";
import { DialogResponses } from "../DialogResponses";
import { FileUtility } from "../FileUtility";
import { TelemetryContext } from "../telemetry";
import { delay, getEnumKeyByEnumValue, getRegistryValues } from "../utils";
import { Board } from "./Interfaces/Board";
import { reject } from "bluebird";

import { ArduinoDeviceBase } from "./ArduinoDeviceBase";
import { DeviceType } from "./Interfaces/Device";
import { DeviceConfig, TemplateFileInfo } from "./Interfaces/ProjectTemplate";
import { FileNotFoundError } from "../common/Error/OperationFailedErrors/FileNotFound";
import { DirectoryNotFoundError } from "../common/Error/OperationFailedErrors/DirectoryNotFoundError";
import { SystemResourceNotFoundError } from "../common/Error/SystemErrors/SystemResourceNotFoundError";
import { AzureConfigFileHandler } from "./AzureComponentConfig";
import { ComponentType } from "./Interfaces/Component";

const impor = require("impor")(__dirname);
const forEach = impor("lodash.foreach") as typeof import("lodash.foreach");
const trimStart = impor("lodash.trimstart") as typeof import("lodash.trimstart");

interface SerialPortInfo {
  path: string;
  manufacturer: string;
  vendorId: string;
  productId: string;
}

const constants = {
  outputPath: "./.build",
  platformLocalFileName: "platform.local.txt",
  cExtraFlag: 'compiler.c.extra_flags=-DCORRELATIONID="',
  cppExtraFlag: 'compiler.cpp.extra_flags=-DCORRELATIONID="',
  traceExtraFlag: " -DENABLETRACE=",
  informationPageUrl: "https://aka.ms/AA35xln"
};

enum ConfigDeviceOptions {
  ConnectionString = "Config Device Connection String",
  UDS = "Config DPS Unique Device Secret (UDS)",
  DPS = "Config DPS credentials",
  CRC = "Generate CRC for OTA"
}

enum DeviceConnectionStringAcquisitionMethods {
  Input = "Input IoT Hub Device Connection String",
  Select = "Select IoT Hub Device Connection String"
}

export class AZ3166Device extends ArduinoDeviceBase {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  static get serialport(): any {
    if (!AZ3166Device._serialport) {
      AZ3166Device._serialport = require("node-usb-native").SerialPort;
    }
    return AZ3166Device._serialport;
  }

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  private static _serialport: any;

  private componentId: string;
  get id(): string {
    return this.componentId;
  }

  private static _boardId = "devkit";

  private azureConfigFileHandler: AzureConfigFileHandler;

  static get boardId(): string {
    return AZ3166Device._boardId;
  }

  constructor(
    context: vscode.ExtensionContext,
    channel: vscode.OutputChannel,
    telemetryContext: TelemetryContext,
    devicePath: string,
    templateFiles?: TemplateFileInfo[]
  ) {
    super(context, devicePath, channel, telemetryContext, DeviceType.MXChipAZ3166);
    this.channel = channel;
    this.componentId = Guid.create().toString();
    if (templateFiles) {
      this.templateFiles = templateFiles;
    }
    const projectFolder = devicePath + "/..";
    this.azureConfigFileHandler = new AzureConfigFileHandler(projectFolder);
  }

  name = "AZ3166";

  get board(): Board {
    const boardProvider = new BoardProvider(this.boardFolderPath);
    const az3166 = boardProvider.find({ id: AZ3166Device._boardId });
    if (!az3166) {
      throw new SystemResourceNotFoundError("AZ3166 board", `board id ${AZ3166Device._boardId}`, "board list");
    }
    return az3166;
  }

  get version(): string {
    const packageRootPath = this.getArduinoPackagePath();
    let version = "0.0.1";

    if (fs.existsSync(packageRootPath)) {
      const versions = fs.readdirSync(packageRootPath);
      if (versions[0]) {
        version = versions[0];
      }
    }

    return version;
  }

  async create(): Promise<void> {
    this.createCore();
  }

  async preCompileAction(): Promise<boolean> {
    await this.generatePlatformLocal();
    return true;
  }

  async preUploadAction(): Promise<boolean> {
    const isStlinkInstalled = await this.stlinkDriverInstalled();
    if (!isStlinkInstalled) {
      const message = "The ST-LINK driver for DevKit is not installed. Install now?";
      const result: vscode.MessageItem | undefined = await vscode.window.showWarningMessage(
        message,
        DialogResponses.yes,
        DialogResponses.skipForNow,
        DialogResponses.cancel
      );
      if (result === DialogResponses.yes) {
        // Open the download page
        const installUri = "http://www.st.com/en/development-tools/stsw-link009.html";
        opn(installUri);
        return true;
      } else if (result !== DialogResponses.cancel) {
        return false;
      }
    }
    // Enable logging on IoT Devkit
    await this.generatePlatformLocal();
    return true;
  }

  async configDeviceSettings(): Promise<void> {
    // Select device settings type
    const deviceSettingType = await this.selectDeviceSettingType();

    let credentials = "";
    switch (deviceSettingType) {
      case ConfigDeviceOptions.CRC:
        await this.generateCrc(this.channel);
        return;
      case ConfigDeviceOptions.ConnectionString:
        // Get device connection string
        credentials = await this.getDeviceConnectionString();

        await this.logAndSetCredentials(credentials, ConfigDeviceOptions.ConnectionString);
        return;
      case ConfigDeviceOptions.DPS:
        // Get DPS Credential
        credentials = await this.getDPSCredentialsFromInput();

        await this.logAndSetCredentials(credentials, ConfigDeviceOptions.DPS);
        return;
      case ConfigDeviceOptions.UDS:
        // Get UDS string
        credentials = await this.getUDSStringFromInput();

        await this.logAndSetCredentials(credentials, ConfigDeviceOptions.UDS);
        return;
      default:
        throw new TypeNotSupportedError("device setting type", `${deviceSettingType}`);
    }
  }

  // Private functions for configure device settings

  /**
   * Print credentials in log. Set credentials to device.
   * Pop up information message suggesting configuration operation is
   * successful.
   * @param credentials device credentials
   * @param deviceSettingType device setting type
   * @param deviceSettingsType device settings type info to be print in warning
   * window
   */
  private async logAndSetCredentials(credentials: string, deviceSettingType: ConfigDeviceOptions): Promise<void> {
    // Log Credentials
    console.log(credentials);

    // Set credentials
    const res = await this.setDeviceConfig(credentials, deviceSettingType); // TODO: Mind the return value.
    if (!res) {
      throw new OperationFailedError(
        "flush configuration to device",
        "",
        "Please check out error message in the output channel."
      );
    }
    let deviceSettingTypeForLog;
    switch (deviceSettingType) {
      case ConfigDeviceOptions.ConnectionString:
        deviceSettingTypeForLog = "device connection string";
        break;
      case ConfigDeviceOptions.DPS:
        deviceSettingTypeForLog = "DPS credentials";
        break;
      case ConfigDeviceOptions.UDS:
        deviceSettingTypeForLog = "Unique Device String (UDS)";
        break;
      default:
        throw new TypeNotSupportedError("device setting type", `${deviceSettingType}`);
    }

    vscode.window.showInformationMessage(`Successfully configure ${deviceSettingTypeForLog}.`);
  }

  /**
   * Select device setting type.
   */
  private async selectDeviceSettingType(): Promise<ConfigDeviceOptions> {
    const configSelectionItems = await this.getConfigDeviceSettingTypeOptions();
    const configSelection = await vscode.window.showQuickPick(configSelectionItems, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: "Select an option"
    });
    if (!configSelection) {
      throw new OperationCanceledError("Config device settings option selection cancelled.");
    }

    const deviceSettingsType: ConfigDeviceOptions = getEnumKeyByEnumValue(ConfigDeviceOptions, configSelection.label);
    return deviceSettingsType;
  }

  /**
   * Get config device setting type options.
   */
  private async getConfigDeviceSettingTypeOptions(): Promise<vscode.QuickPickItem[]> {
    // Read options configuration JSON
    const devciceConfigFilePath: string = this.extensionContext.asAbsolutePath(
      path.join(FileNames.resourcesFolderName, FileNames.templatesFolderName, FileNames.configDeviceOptionsFileName)
    );

    const configSelectionItemsFilePath = await FileUtility.readFile(ScaffoldType.Local, devciceConfigFilePath, "utf8");
    const configSelectionItemsContent = JSON.parse(configSelectionItemsFilePath as string);

    const configSelectionItems: vscode.QuickPickItem[] = [];
    configSelectionItemsContent.configSelectionItems.forEach((element: DeviceConfig) => {
      configSelectionItems.push({ label: element.label, description: "", detail: element.detail });
    });

    return configSelectionItems;
  }

  /**
   * Get device connection string.
   * Either get from workspace config or input one.
   */
  private async getDeviceConnectionString(): Promise<string> {
    // Get device connection string from workspace config
    let deviceConnectionStringFromConfig: string | undefined;
    const componentConfig = await this.azureConfigFileHandler.getComponentByType(
      ScaffoldType.Workspace,
      ComponentType.IoTHubDevice
    );
    if (componentConfig) {
      deviceConnectionStringFromConfig = componentConfig.componentInfo?.values.iotHubDeviceConnectionString;
    }

    let deviceConnectionString: string;
    if (deviceConnectionStringFromConfig) {
      // Select method to acquire device connection string
      const deviceConnectionStringAcquisitionMethodSelection = await this.selectDeviceConnectionStringAcquisitionMethod(
        deviceConnectionStringFromConfig
      );

      if (deviceConnectionStringAcquisitionMethodSelection.label === DeviceConnectionStringAcquisitionMethods.Select) {
        deviceConnectionString = deviceConnectionStringFromConfig;
        return deviceConnectionString;
      }
    }
    deviceConnectionString = await this.getInputDeviceConnectionString();

    return deviceConnectionString;
  }

  /**
   * Select method to get device connection string: input a new one or get from
   * configuration.
   */
  private async selectDeviceConnectionStringAcquisitionMethod(
    deviceConnectionString: string
  ): Promise<vscode.QuickPickItem> {
    const deviceConnectionStringAcquisitionOptions = this.getDeviceConnectionStringAcquisitionOptions(
      deviceConnectionString
    );
    const deviceConnectionStringAcquisitionSelection = await vscode.window.showQuickPick(
      deviceConnectionStringAcquisitionOptions,
      { ignoreFocusOut: true, placeHolder: "Choose an option:" }
    );

    if (!deviceConnectionStringAcquisitionSelection) {
      throw new OperationCanceledError("Device connection string acquisition method selection cancelled.");
    }

    return deviceConnectionStringAcquisitionSelection;
  }

  private getDeviceConnectionStringAcquisitionOptions(deviceConnectionString: string): vscode.QuickPickItem[] {
    let deviceConnectionStringAcquisitionOptions: vscode.QuickPickItem[] = [];
    const inputDeviceConnectionStringOption = {
      label: DeviceConnectionStringAcquisitionMethods.Input,
      description: "",
      detail: ""
    };

    let hostName = "";
    let deviceId = "";
    const hostnameMatches = deviceConnectionString.match(/HostName=(.*?)(;|$)/);
    if (hostnameMatches) {
      hostName = hostnameMatches[0];
    }

    const deviceIDMatches = deviceConnectionString.match(/DeviceId=(.*?)(;|$)/);
    if (deviceIDMatches) {
      deviceId = deviceIDMatches[0];
    }

    if (deviceId && hostName) {
      deviceConnectionStringAcquisitionOptions = [
        {
          label: DeviceConnectionStringAcquisitionMethods.Select,
          description: "",
          detail: `Device Information: ${hostName} ${deviceId}`
        },
        inputDeviceConnectionStringOption
      ];
    } else {
      deviceConnectionStringAcquisitionOptions = [inputDeviceConnectionStringOption];
    }

    return deviceConnectionStringAcquisitionOptions;
  }

  private async getInputDeviceConnectionString(): Promise<string> {
    const option = this.getInputDeviceConnectionStringOptions();
    const deviceConnectionString = await vscode.window.showInputBox(option);
    if (!deviceConnectionString) {
      const message = "Need more information on how to get device connection string?";
      const result: vscode.MessageItem | undefined = await vscode.window.showWarningMessage(
        message,
        DialogResponses.yes,
        DialogResponses.no
      );
      if (result === DialogResponses.yes) {
        opn(constants.informationPageUrl);
      }
      throw new OperationCanceledError("Fail to get input device connection string.");
    }

    return deviceConnectionString;
  }

  private getInputDeviceConnectionStringOptions(): vscode.InputBoxOptions {
    const option: vscode.InputBoxOptions = {
      value: "HostName=<Host Name>;DeviceId=<Device Name>;SharedAccessKey=<Device Key>",
      prompt: `Please input device connection string here.`,
      ignoreFocusOut: true,
      validateInput: (deviceConnectionString: string) => {
        if (!deviceConnectionString) {
          return "Please provide a valid device connection string.";
        }

        if (
          deviceConnectionString.indexOf("HostName") === -1 ||
          deviceConnectionString.indexOf("DeviceId") === -1 ||
          deviceConnectionString.indexOf("SharedAccessKey") === -1
        ) {
          return "The format of the IoT Hub Device connection string is invalid.";
        }
        return;
      }
    };

    return option;
  }

  /**
   * Get DPS credentials from input box.
   */
  private async getDPSCredentialsFromInput(): Promise<string> {
    const option = this.getDPSConnectionStringOptions();
    const dpsCredential = await vscode.window.showInputBox(option);
    if (!dpsCredential) {
      throw new OperationCanceledError("DPS credentials input cancelled.");
    }
    return dpsCredential;
  }

  private getDPSConnectionStringOptions(): vscode.InputBoxOptions {
    const option: vscode.InputBoxOptions = {
      value:
        "DPSEndpoint=global.azure-devices-provisioning.net;IdScope=<Id Scope>;DeviceId=<Device Id>;SymmetricKey=<Symmetric Key>",
      prompt: `Please input DPS credentials here.`,
      ignoreFocusOut: true,
      validateInput: (deviceConnectionString: string) => {
        if (!deviceConnectionString) {
          return "Please provide a valid DPS credentials.";
        }

        if (
          deviceConnectionString.indexOf("DPSEndpoint") === -1 ||
          deviceConnectionString.indexOf("IdScope") === -1 ||
          deviceConnectionString.indexOf("DeviceId") === -1 ||
          deviceConnectionString.indexOf("SymmetricKey") === -1
        ) {
          return "The format of the DPS credentials is invalid.";
        }
        return;
      }
    };

    return option;
  }

  /**
   * Get UDS string from input box.
   */
  private async getUDSStringFromInput(): Promise<string> {
    const option = this.getUDSStringOptions();
    const UDS = await vscode.window.showInputBox(option);
    if (!UDS) {
      throw new OperationCanceledError("UDS string input cancelled.");
    }

    return UDS;
  }

  private getUDSStringOptions(): vscode.InputBoxOptions {
    function generateRandomHex(): string {
      const chars = "0123456789abcdef".split("");
      let hexNum = "";
      for (let i = 0; i < 64; i++) {
        hexNum += chars[Math.floor(Math.random() * 16)];
      }
      return hexNum;
    }

    const option: vscode.InputBoxOptions = {
      value: generateRandomHex(),
      prompt: `Please input Unique Device String (UDS) here.`,
      ignoreFocusOut: true,
      validateInput: (UDS: string) => {
        if (/^([0-9a-f]){64}$/i.test(UDS) === false) {
          return "The format of the UDS is invalid. Please provide a valid UDS.";
        }
        return "";
      }
    };
    return option;
  }

  /**
   * Flush device configurations to device
   * @param configValue config value
   * @param option device configuration type
   */
  private async setDeviceConfig(configValue: string, option: ConfigDeviceOptions): Promise<boolean> {
    // Try to close serial monitor
    try {
      await vscode.commands.executeCommand(ArduinoCommands.CloseSerialMonitor, null, false);
    } catch (ignore) {
      // Ignore error if fail to close serial monitor
    }

    // Set selected connection string to device
    const platform = os.platform();
    if (platform === OSPlatform.WIN32) {
      return await this.flushDeviceConfig(configValue, option);
    } else {
      return await this.flushDeviceConfigUnixAndMac(configValue, option);
    }
  }

  private flushDeviceConfigUnixAndMac(configValue: string, option: ConfigDeviceOptions): Promise<boolean> {
    return new Promise(
      // eslint-disable-next-line no-async-promise-executor
      async (resolve: (value: boolean) => void, reject: (value: Error) => void) => {
        let comPort = "";
        let command = "";
        try {
          // Choose COM port that AZ3166 is connected
          comPort = await this.chooseCOM();
          console.log(`Opening ${comPort}.`);
        } catch (error) {
          return reject(error);
        }
        if (option === ConfigDeviceOptions.ConnectionString) {
          command = "set_az_iothub";
        } else if (option === ConfigDeviceOptions.DPS) {
          command = "set_az_iotdps";
        } else {
          command = "set_dps_uds";
        }
        let errorRejected = false;

        let az3166: Board;
        try {
          az3166 = this.board;
        } catch (error) {
          return reject(error);
        }

        const port = new AZ3166Device.serialport(comPort, {
          baudRate: az3166.defaultBaudRate,
          dataBits: 8,
          stopBits: 1,
          xon: false,
          xoff: false,
          parity: "none"
        });

        const rejectIfError = (err: Error): boolean => {
          if (errorRejected) return true;
          if (err) {
            errorRejected = true;
            reject(err);
            try {
              port.close();
            } catch (ignore) {
              // ignore error if fail to close port.
            }
          }

          return true;
        };

        const executeSetAzIoTHub = async (): Promise<void> => {
          try {
            const data = `${command} "${configValue}"\r\n`;

            let restDataLength = data.length;
            while (restDataLength > 0) {
              const start = data.length - restDataLength;
              const length = Math.min(100, restDataLength);
              restDataLength -= length;
              const dataChunk = data.substr(start, length);
              await this.sendDataViaSerialPort(port, dataChunk);
              await delay(1000);
            }

            port.close();
          } catch (ignore) {
            // Ignore error if fail to close port
          }

          if (errorRejected) {
            return;
          } else {
            resolve(true);
          }
        };

        // Configure serial port callbacks
        port.on("open", async () => {
          // eslint-disable-next-line  @typescript-eslint/no-explicit-any
          await vscode.window.showInformationMessage(
            "Please hold down button A and then push and release the reset button to enter configuration mode. After enter configuration mode, click OK.",
            "OK"
          );
          executeSetAzIoTHub()
            .then(() => resolve(true))
            .catch(error => reject(error));
        });

        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        port.on("error", (error: any) => {
          if (errorRejected) return;
          console.log(error);
          rejectIfError(error);
        });
      }
    );
  }

  private flushDeviceConfig(configValue: string, option: ConfigDeviceOptions): Promise<boolean> {
    return new Promise(
      // eslint-disable-next-line no-async-promise-executor
      async (resolve: (value: boolean) => void, reject: (value: Error) => void) => {
        let comPort = "";
        let command = "";
        try {
          // Choose COM port that AZ3166 is connected
          comPort = await this.chooseCOM();
          console.log(`Opening ${comPort}.`);
        } catch (error) {
          reject(error);
        }
        if (option === ConfigDeviceOptions.ConnectionString) {
          command = "set_az_iothub";
        } else if (option === ConfigDeviceOptions.DPS) {
          command = "set_az_iotdps";
        } else {
          command = "set_dps_uds";
        }
        let configMode = false;
        let errorRejected = false;
        let commandExecuted = false;
        let gotData = false;

        let az3166: Board;
        try {
          az3166 = this.board;
        } catch (error) {
          return reject(error);
        }

        const port = new AZ3166Device.serialport(comPort, {
          baudRate: az3166.defaultBaudRate,
          dataBits: 8,
          stopBits: 1,
          xon: false,
          xoff: false,
          parity: "none"
        });

        const rejectIfError = (err: Error): boolean => {
          if (errorRejected) return true;
          if (err) {
            errorRejected = true;
            reject(err);
            try {
              port.close();
            } catch (ignore) {
              // Ignore error if fail to close port
            }
          }

          return true;
        };

        const executeSetAzIoTHub = async (): Promise<void> => {
          try {
            const data = `${command} "${configValue}"\r\n`;
            const maxDataLength = 256;
            await this.sendDataViaSerialPort(port, data.slice(0, maxDataLength));
            if (data.length > maxDataLength) {
              await delay(1000);
              await this.sendDataViaSerialPort(port, data.slice(maxDataLength));
            }

            await delay(1000);
            port.close();
          } catch (ignore) {
            // Ignore error if fail to close port
          }

          if (errorRejected) {
            return;
          } else {
            resolve(true);
          }
        };

        // Configure serial port callbacks
        port.on("open", () => {
          port.write(
            "\r\nhelp\r\n",
            // eslint-disable-next-line  @typescript-eslint/no-explicit-any
            (error: any) => {
              if (rejectIfError(error)) return;
            }
          );
        });

        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        port.on("data", (data: any) => {
          gotData = true;
          const output = data.toString().trim();

          if (commandExecuted) return;
          if (output.includes("set_")) {
            commandExecuted = true;
            configMode = true;
            executeSetAzIoTHub()
              .then(() => resolve(true))
              .catch(error => reject(error));
          } else {
            configMode = false;
          }

          if (configMode) {
            forEach(output.split("\n"), line => {
              if (line) {
                line = trimStart(line.trim(), "#").trim();
                if (line && line.length) {
                  console.log("SerialOutput", line);
                }
              }
            });
          }
        });

        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        port.on("error", (error: any) => {
          if (errorRejected) return;
          console.log(error);
          rejectIfError(error);
        });

        setTimeout(() => {
          if (errorRejected) return;
          // Prompt user to enter configuration mode

          if (!gotData || !configMode) {
            vscode.window
              .showInformationMessage(
                "Please hold down button A and then push and release the reset button to enter configuration mode."
              )
              .then(() => {
                port.write(
                  "\r\nhelp\r\n",

                  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
                  (error: any) => {
                    rejectIfError(error);
                  }
                );
              });
          }
        }, 10000);
      }
    );
  }

  private async getComList(): Promise<SerialPortInfo[]> {
    const lists = await AZ3166Device.serialport.list();
    if (!lists.length) {
      vscode.window.showInformationMessage("No serial port is available.");
    }
    return lists;
  }

  private async chooseCOM(): Promise<string> {
    return new Promise(async (resolve: (value: string) => void, reject: (reason: Error) => void) => {
      const comList = await this.getComList();

      let az3166: Board;
      try {
        az3166 = this.board;
      } catch (error) {
        return reject(error);
      }

      const list = _.filter(comList, com => {
        if (
          com.vendorId &&
          com.productId &&
          az3166.vendorId &&
          az3166.productId &&
          com.vendorId.toLowerCase().endsWith(az3166.vendorId) &&
          com.productId.toLowerCase().endsWith(az3166.productId)
        ) {
          return true;
        } else {
          return false;
        }
      });

      if (list && list.length) {
        let comPort = list[0].path;
        if (list.length > 1) {
          // TODO: select com port from list when there are multiple AZ3166
          // boards connected
          comPort = list[0].path;
        }

        if (!comPort) {
          reject(new ResourceNotFoundError("choose COM", "avaliable COM port.", "Please check COM port settings."));
        }

        resolve(comPort);
      } else {
        reject(new Error("No AZ3166 board connected."));
      }
    });
  }

  private async sendDataViaSerialPort(
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    port: any,
    data: string
  ): Promise<boolean> {
    return new Promise((resolve: (value: boolean) => void, reject: (value: Error) => void) => {
      try {
        port.write(
          data,
          // eslint-disable-next-line  @typescript-eslint/no-explicit-any
          (err: any) => {
            if (err) {
              reject(err);
            } else {
              port.drain(() => resolve(true));
            }
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  private async stlinkDriverInstalled(): Promise<boolean> {
    const platform = os.platform();
    if (platform === OSPlatform.WIN32) {
      try {
        // The STlink driver would write to the following registry.
        const pathString = await getRegistryValues(
          WinReg.HKLM,
          "\\SYSTEM\\ControlSet001\\Control\\Class\\{88bae032-5a81-49f0-bc3d-a4ff138216d6}",
          "Class"
        );
        if (pathString) {
          return true;
        } else {
          return false;
        }
      } catch (error) {
        return false;
      }
    }
    // For other OS platform, there is no need to install STLink Driver.
    return true;
  }

  private async generatePlatformLocal(): Promise<void> {
    const arduinoPackagePath = this.getArduinoPackagePath();

    function getHashMacAsync(): Promise<unknown> {
      return new Promise(resolve => {
        getmac.getMac((err, macAddress) => {
          if (err) {
            reject(err);
          }
          const hashMacAddress = crypto
            .createHash("sha256")
            .update(macAddress, "utf8")
            .digest("hex");
          resolve(hashMacAddress);
        });
      });
    }

    if (!fs.existsSync(arduinoPackagePath)) {
      const suggestedOperation =
        'Please install it from https://www.arduino.cc/en/main/software and use "Arduino: Board Manager" to install your device packages. Restart VS Code to apply to changes.';
      throw new ResourceNotFoundError(
        `generate ${constants.platformLocalFileName} file`,
        "Arduino IDE",
        suggestedOperation
      );
    }

    const files = fs.readdirSync(arduinoPackagePath);
    for (let i = files.length - 1; i >= 0; i--) {
      if (files[i] === ".DS_Store") {
        files.splice(i, 1);
      }
    }

    if (files.length === 0 || files.length > 1) {
      throw new FileNotFoundError(
        `generate ${constants.platformLocalFileName} file`,
        `files under Arduino package installation path ${arduinoPackagePath}`,
        "Please clear the path and reinstall the package for Devkit."
      );
    }

    const directoryName = path.join(arduinoPackagePath, files[0]);
    if (!fs.isDirectorySync(directoryName)) {
      throw new DirectoryNotFoundError(
        `generate ${constants.platformLocalFileName} file`,
        "Arduino package for MXChip IoT Devkit",
        "Please follow guide to install the DevKit package."
      );
    }

    const fileName = path.join(directoryName, constants.platformLocalFileName);
    if (!fs.existsSync(fileName)) {
      const enableTrace = 1;
      const hashMacAddress = await getHashMacAsync();

      // Create the file of platform.local.txt
      const targetFileName = path.join(directoryName, constants.platformLocalFileName);

      const content =
        `${constants.cExtraFlag}${hashMacAddress}" ${constants.traceExtraFlag}${enableTrace}\r\n` +
        `${constants.cppExtraFlag}${hashMacAddress}" ${constants.traceExtraFlag}${enableTrace}\r\n`;
      fs.writeFileSync(targetFileName, content);
    }
  }

  private getArduinoPackagePath(): string {
    const platform = os.platform();

    // TODO: Currently, we do not support portable Arduino installation.
    let arduinoPackagePath = "";
    const homeDir = os.homedir();

    if (platform === OSPlatform.WIN32) {
      arduinoPackagePath = path.join(homeDir, "AppData", "Local", "Arduino15", "packages");
    } else if (platform === OSPlatform.DARWIN) {
      arduinoPackagePath = path.join(homeDir, "Library", "Arduino15", "packages");
    } else if (platform === OSPlatform.LINUX) {
      arduinoPackagePath = path.join(homeDir, ".arduino15", "packages");
    }

    return path.join(arduinoPackagePath, "AZ3166", "hardware", "stm32f4");
  }
}
