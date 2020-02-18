// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Guid } from "guid-typescript";
import * as vscode from "vscode";

import { OperationFailedError } from "../common/Error/OperationFailedErrors/OperationFailedError";
import { DependentExtensionNotFoundError } from "../common/Error/OperationFailedErrors/DependentExtensionNotFoundError";
import { ScaffoldType } from "../constants";
import { channelPrintJsonObject, channelShowAndAppendLine } from "../utils";

import { getExtension } from "./Apis";
import { AzureComponentConfig, AzureConfigFileHandler, ComponentInfo, DependencyConfig } from "./AzureComponentConfig";
import { AzureUtility } from "./AzureUtility";
import { ExtensionName } from "./Interfaces/Api";
import { Component, ComponentType } from "./Interfaces/Component";
import { Provisionable } from "./Interfaces/Provisionable";
import { ArgumentEmptyOrNullError } from "../common/Error/OperationFailedErrors/ArgumentEmptyOrNullError";

export class IoTHub implements Component, Provisionable {
  dependencies: DependencyConfig[] = [];
  private componentType: ComponentType;
  private channel: vscode.OutputChannel;
  private projectRootPath: string;
  private componentId: string;
  private azureConfigFileHandler: AzureConfigFileHandler;
  get id(): string {
    return this.componentId;
  }

  constructor(projectRoot: string, channel: vscode.OutputChannel) {
    this.componentType = ComponentType.IoTHub;
    this.channel = channel;
    this.componentId = Guid.create().toString();
    this.projectRootPath = projectRoot;
    this.azureConfigFileHandler = new AzureConfigFileHandler(this.projectRootPath);
  }

  name = "IoT Hub";

  getComponentType(): ComponentType {
    return this.componentType;
  }

  async checkPrerequisites(): Promise<boolean> {
    return true;
  }

  async load(): Promise<void> {
    const componentConfig = await this.azureConfigFileHandler.getComponentByType(
      ScaffoldType.Workspace,
      this.componentType
    );
    if (componentConfig) {
      this.componentId = componentConfig.id;
      this.dependencies = componentConfig.dependencies;
    }
  }

  async create(): Promise<void> {
    await this.updateConfigSettings(ScaffoldType.Local);
  }

  async provision(): Promise<boolean> {
    const provisionIothubSelection: vscode.QuickPickItem[] = [
      {
        label: "Select an existing IoT Hub",
        description: "Select an existing IoT Hub",
        detail: "select"
      },
      {
        label: "Create a new IoT Hub",
        description: "Create a new IoT Hub",
        detail: "create"
      }
    ];
    const selection = await vscode.window.showQuickPick(provisionIothubSelection, {
      ignoreFocusOut: true,
      placeHolder: "Provision IoT Hub"
    });

    if (!selection) {
      return false;
    }

    const toolkit = getExtension(ExtensionName.Toolkit);
    if (!toolkit) {
      throw new DependentExtensionNotFoundError("provision IoT Hub", ExtensionName.Toolkit);
    }

    let iothub = null;
    const subscriptionId = AzureUtility.subscriptionId;
    const resourceGroup = AzureUtility.resourceGroup;

    switch (selection.detail) {
      case "select":
        iothub = await toolkit.azureIoTExplorer.selectIoTHub(this.channel, subscriptionId);
        break;
      case "create":
        if (this.channel) {
          channelShowAndAppendLine(this.channel, "Creating new IoT Hub...");
        }

        iothub = await toolkit.azureIoTExplorer.createIoTHub(this.channel, subscriptionId, resourceGroup);
        break;
      default:
        break;
    }

    if (iothub && iothub.iotHubConnectionString) {
      if (this.channel) {
        channelPrintJsonObject(this.channel, iothub);
      }

      const sharedAccessKeyMatches = iothub.iotHubConnectionString.match(/SharedAccessKey=([^;]*)/);
      if (!sharedAccessKeyMatches || sharedAccessKeyMatches.length < 2) {
        throw new OperationFailedError(
          "parse shared access key from IoT Hub connection string",
          "IoT Hub connection string is not valid.",
          "Please retry Azure Provision."
        );
      }

      const sharedAccessKey = sharedAccessKeyMatches[1];

      const eventHubConnectionString = `Endpoint=${iothub.properties.eventHubEndpoints.events.endpoint};\
      SharedAccessKeyName=iothubowner;SharedAccessKey=${sharedAccessKey}`;
      const eventHubConnectionPath = iothub.properties.eventHubEndpoints.events.path;

      const scaffoldType = ScaffoldType.Workspace;
      await this.updateConfigSettings(scaffoldType, {
        values: {
          iotHubConnectionString: iothub.iotHubConnectionString,
          eventHubConnectionString,
          eventHubConnectionPath
        }
      });

      if (this.channel) {
        channelShowAndAppendLine(this.channel, "IoT Hub provision succeeded.");
      }
      return true;
    } else if (!iothub) {
      return false;
    } else {
      throw new OperationFailedError(
        "provision IoT Hub",
        "IoT Hub connection string does not exist.",
        "Please retry Azure Provision."
      );
    }
  }

  async updateConfigSettings(type: ScaffoldType, componentInfo?: ComponentInfo): Promise<void> {
    const iotHubComponentIndex = await this.azureConfigFileHandler.getComponentIndexById(type, this.id);

    if (iotHubComponentIndex > -1) {
      if (!componentInfo) {
        throw new ArgumentEmptyOrNullError("IoTHub updateConfigSettings", "componentInfo");
      }
      await this.azureConfigFileHandler.updateComponent(type, iotHubComponentIndex, componentInfo);
    } else {
      const newIoTHubConfig: AzureComponentConfig = {
        id: this.id,
        folder: "",
        name: "",
        dependencies: [],
        type: this.componentType,
        componentInfo
      };
      await this.azureConfigFileHandler.appendComponent(type, newIoTHubConfig);
    }
  }
}
