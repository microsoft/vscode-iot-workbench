// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as iothub from "azure-iothub";
import { Guid } from "guid-typescript";
import * as vscode from "vscode";

import { ScaffoldType } from "../constants";

import { DependentExtensionNotFoundError } from "../common/Error/OperationFailedErrors/DependentExtensionNotFoundError";

import { getExtension } from "./Apis";
import {
  AzureComponentConfig,
  AzureConfigFileHandler,
  ComponentInfo,
  DependencyConfig,
  Dependency
} from "./AzureComponentConfig";
import { ExtensionName } from "./Interfaces/Api";
import { Component, ComponentType } from "./Interfaces/Component";
import { Provisionable } from "./Interfaces/Provisionable";
import { AzureConfigNotFoundError } from "../common/Error/SystemErrors/AzureConfigNotFoundErrors";

async function getDeviceNumber(iotHubConnectionString: string): Promise<number> {
  return new Promise((resolve: (value: number) => void, reject: (error: Error) => void) => {
    const registry: iothub.Registry = iothub.Registry.fromConnectionString(iotHubConnectionString);
    registry.list((err, list) => {
      if (err) {
        return reject(err);
      }
      if (!list) {
        return resolve(0);
      } else {
        return resolve(list.length);
      }
    });
  });
}

async function getProvisionIothubDeviceSelection(iotHubConnectionString: string): Promise<vscode.QuickPickItem[]> {
  let provisionIothubDeviceSelection: vscode.QuickPickItem[];

  const deviceNumber = await getDeviceNumber(iotHubConnectionString);
  if (deviceNumber > 0) {
    provisionIothubDeviceSelection = [
      {
        label: "Select an existing IoT Hub device",
        description: "Select an existing IoT Hub device",
        detail: "select"
      },
      {
        label: "Create a new IoT Hub device",
        description: "Create a new IoT Hub device",
        detail: "create"
      }
    ];
  } else {
    provisionIothubDeviceSelection = [
      {
        label: "Create a new IoT Hub device",
        description: "Create a new IoT Hub device",
        detail: "create"
      }
    ];
  }
  return provisionIothubDeviceSelection;
}

export class IoTHubDevice implements Component, Provisionable {
  private componentType: ComponentType;
  private channel: vscode.OutputChannel;
  private projectRootPath: string;
  private componentId: string;
  private azureConfigFileHandler: AzureConfigFileHandler;
  get id(): string {
    return this.componentId;
  }

  dependencies: DependencyConfig[] = [];

  constructor(projectRoot: string, channel: vscode.OutputChannel, dependencyComponents: Dependency[] | null = null) {
    this.componentType = ComponentType.IoTHubDevice;
    this.channel = channel;
    this.componentId = Guid.create().toString();
    this.projectRootPath = projectRoot;
    this.azureConfigFileHandler = new AzureConfigFileHandler(this.projectRootPath);

    if (dependencyComponents && dependencyComponents.length > 0) {
      dependencyComponents.forEach(dependency =>
        this.dependencies.push({ id: dependency.component.id, type: dependency.type })
      );
    }
  }

  name = "IoT Hub Device";

  getComponentType(): ComponentType {
    return this.componentType;
  }

  async checkPrerequisites(): Promise<void> {
    // Do nothing.
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
    const scaffoldType = ScaffoldType.Workspace;
    const iotHubId = this.dependencies[0].id;
    const componentConfig = await this.azureConfigFileHandler.getComponentById(scaffoldType, iotHubId);
    if (!componentConfig) {
      throw new AzureConfigNotFoundError(`component of config id ${iotHubId}`);
    }
    if (!componentConfig.componentInfo) {
      throw new AzureConfigNotFoundError(`componentInfo of config id ${iotHubId}`);
    }
    const iotHubConnectionString = componentConfig.componentInfo.values.iotHubConnectionString;
    if (!iotHubConnectionString) {
      throw new AzureConfigNotFoundError(`iotHubConnectionString of config id ${iotHubId}`);
    }
    const selection = await vscode.window.showQuickPick(getProvisionIothubDeviceSelection(iotHubConnectionString), {
      ignoreFocusOut: true,
      placeHolder: "Provision IoTHub Device"
    });

    if (!selection) {
      return false;
    }

    const toolkit = getExtension(ExtensionName.Toolkit);
    if (!toolkit) {
      throw new DependentExtensionNotFoundError("provision IoT Hub Device", ExtensionName.Toolkit);
    }

    let device = null;
    switch (selection.detail) {
      case "select":
        device = await toolkit.azureIoTExplorer.getDevice(null, iotHubConnectionString, this.channel);
        if (!device) {
          return false;
        } else {
          await this.updateConfigSettings(scaffoldType, {
            values: {
              iotHubConnectionString,
              iotHubDeviceConnectionString: device.connectionString
            }
          });
        }
        break;

      case "create":
        device = await toolkit.azureIoTExplorer.createDevice(false, iotHubConnectionString, this.channel);
        if (!device) {
          return false;
        } else {
          await this.updateConfigSettings(scaffoldType, {
            values: {
              iotHubConnectionString,
              iotHubDeviceConnectionString: device.connectionString
            }
          });
        }
        break;
      default:
        break;
    }
    return true;
  }

  async updateConfigSettings(type: ScaffoldType, componentInfo?: ComponentInfo): Promise<void> {
    const iotHubComponentIndex = await this.azureConfigFileHandler.getComponentIndexById(type, this.id);
    if (iotHubComponentIndex > -1) {
      if (componentInfo) {
        await this.azureConfigFileHandler.updateComponent(type, iotHubComponentIndex, componentInfo);
      }
    } else {
      const newIotHubConfig: AzureComponentConfig = {
        id: this.id,
        folder: "",
        name: "",
        dependencies: this.dependencies,
        type: this.componentType,
        componentInfo
      };
      await this.azureConfigFileHandler.appendComponent(type, newIotHubConfig);
    }
  }
}
