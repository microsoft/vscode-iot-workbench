// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

<<<<<<< bbbda130d6515e3d7f48de5c9ac57cc09ea22585
import * as fs from "fs-plus";
import { Guid } from "guid-typescript";
import * as path from "path";
import * as vscode from "vscode";

import { ConfigHandler } from "../configHandler";
import { AzureComponentsStorage, ConfigKey, ScaffoldType } from "../constants";
import { channelPrintJsonObject, channelShowAndAppendLine } from "../utils";

import { getExtension } from "./Apis";
import {
  AzureComponentConfig,
  AzureConfigFileHandler,
  AzureConfigs,
  ComponentInfo,
  DependencyConfig
} from "./AzureComponentConfig";
import { AzureUtility } from "./AzureUtility";
import { ExtensionName } from "./Interfaces/Api";
import { Component, ComponentType } from "./Interfaces/Component";
import { Provisionable } from "./Interfaces/Provisionable";
=======
import {Guid} from 'guid-typescript';
import * as path from 'path';
import * as vscode from 'vscode';

import {DependentExtensionNotFoundError, OperationFailedError} from '../common/Error/Error';
import {ConfigHandler} from '../configHandler';
import {AzureComponentsStorage, ConfigKey, ScaffoldType} from '../constants';
import {channelPrintJsonObject, channelShowAndAppendLine} from '../utils';

import {getExtension} from './Apis';
import {AzureComponentConfig, AzureConfigFileHandler, ComponentInfo, DependencyConfig} from './AzureComponentConfig';
import {AzureUtility} from './AzureUtility';
import {ExtensionName} from './Interfaces/Api';
import {Component, ComponentType} from './Interfaces/Component';
import {Provisionable} from './Interfaces/Provisionable';
>>>>>>> Define specific error type

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
    this.azureConfigFileHandler = new AzureConfigFileHandler(projectRoot);
  }

  name = "IoT Hub";

  getComponentType(): ComponentType {
    return this.componentType;
  }

  async checkPrerequisites(): Promise<boolean> {
    return true;
  }

  async load(): Promise<void> {
    const azureConfigFilePath = path.join(
      this.projectRootPath,
      AzureComponentsStorage.folderName,
      AzureComponentsStorage.fileName
    );

<<<<<<< bbbda130d6515e3d7f48de5c9ac57cc09ea22585
    if (!fs.existsSync(azureConfigFilePath)) {
      return false;
    }

    let azureConfigs: AzureConfigs;

    try {
      azureConfigs = JSON.parse(fs.readFileSync(azureConfigFilePath, "utf8"));
      const iotHubConfig = azureConfigs.componentConfigs.find(config => config.type === this.componentType);
      if (iotHubConfig) {
        this.componentId = iotHubConfig.id;
        this.dependencies = iotHubConfig.dependencies;
        // Load other information from config file.
      }
    } catch (error) {
      return false;
=======
    const azureConfigs = await AzureConfigFileHandler.loadAzureConfigs(
        ScaffoldType.Workspace, azureConfigFilePath);
    const iotHubConfig = azureConfigs.componentConfigs.find(
        config => config.type === this.componentType);
    if (iotHubConfig) {
      this.componentId = iotHubConfig.id;
      this.dependencies = iotHubConfig.dependencies;
      // Load other information from config file.
>>>>>>> Define specific error type
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
<<<<<<< bbbda130d6515e3d7f48de5c9ac57cc09ea22585
      throw new Error("Azure IoT Hub Toolkit is not installed. Please install it from Marketplace.");
=======
      throw new DependentExtensionNotFoundError(ExtensionName.Toolkit);
>>>>>>> Define specific error type
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
<<<<<<< bbbda130d6515e3d7f48de5c9ac57cc09ea22585
        throw new Error("Cannot parse shared access key from IoT Hub connection string. Please retry Azure Provision.");
=======
        throw new OperationFailedError(
            'parse shared access key from IoT Hub connection string',
            'Please retry Azure Provision.');
>>>>>>> Define specific error type
      }

      const sharedAccessKey = sharedAccessKeyMatches[1];

      const eventHubConnectionString = `Endpoint=${iothub.properties.eventHubEndpoints.events.endpoint};\
      SharedAccessKeyName=iothubowner;SharedAccessKey=${sharedAccessKey}`;
      const eventHubConnectionPath = iothub.properties.eventHubEndpoints.events.path;

      await ConfigHandler.update(ConfigKey.iotHubConnectionString, iothub.iotHubConnectionString);
      await ConfigHandler.update(ConfigKey.eventHubConnectionString, eventHubConnectionString);
      await ConfigHandler.update(ConfigKey.eventHubConnectionPath, eventHubConnectionPath);

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
      throw new Error("IoT Hub provision failed. Please check output window for detail.");
    }
  }

  async updateConfigSettings(type: ScaffoldType, componentInfo?: ComponentInfo): Promise<void> {
    const iotHubComponentIndex = await this.azureConfigFileHandler.getComponentIndexById(type, this.id);

    if (iotHubComponentIndex > -1) {
      if (!componentInfo) {
        return;
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
