// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import {Guid} from 'guid-typescript';
import * as path from 'path';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {AzureComponentsStorage, ConfigKey} from '../constants';
import {OperatingResultType, OperatingResult} from '../OperatingResult';

import {getExtension} from './Apis';
import {AzureComponentConfig, AzureConfigFileHandler, AzureConfigs, ComponentInfo, DependencyConfig} from './AzureComponentConfig';
import {AzureUtility} from './AzureUtility';
import {extensionName} from './Interfaces/Api';
import {Component, ComponentType} from './Interfaces/Component';
import {Provisionable} from './Interfaces/Provisionable';

export class IoTHub implements Component, Provisionable {
  dependencies: DependencyConfig[] = [];
  private componentType: ComponentType;
  private channel: vscode.OutputChannel;
  private projectRootPath: string;
  private componentId: string;
  private azureConfigFileHandler: AzureConfigFileHandler;
  get id() {
    return this.componentId;
  }

  constructor(projectRoot: string, channel: vscode.OutputChannel) {
    this.componentType = ComponentType.IoTHub;
    this.channel = channel;
    this.componentId = Guid.create().toString();
    this.projectRootPath = projectRoot;
    this.azureConfigFileHandler = new AzureConfigFileHandler(projectRoot);
  }

  name = 'IoT Hub';

  getComponentType(): ComponentType {
    return this.componentType;
  }

  async checkPrerequisites(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('IoTHubCheckPrerequisites', OperatingResultType.Succeeded);
    return operatingResult;
  }

  async load(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('IoTHubLoad');
    const azureConfigFilePath = path.join(
        this.projectRootPath, AzureComponentsStorage.folderName,
        AzureComponentsStorage.fileName);

    if (!fs.existsSync(azureConfigFilePath)) {
      operatingResult.update(OperatingResultType.Failed, 'Azure config file is not existing.');
      return operatingResult;
    }

    let azureConfigs: AzureConfigs;

    try {
      azureConfigs = JSON.parse(fs.readFileSync(azureConfigFilePath, 'utf8'));
      const iotHubConfig = azureConfigs.componentConfigs.find(
          config => config.type === ComponentType[this.componentType]);
      if (iotHubConfig) {
        this.componentId = iotHubConfig.id;
        this.dependencies = iotHubConfig.dependencies;
        // Load other information from config file.
      }
    } catch (error) {
      operatingResult.update(OperatingResultType.Failed, '[ERROR] ' + error.message);
    }

    operatingResult.update(OperatingResultType.Succeeded);
    return operatingResult;
  }


  async create(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('IoTHubCreate');
    const res = this.updateConfigSettings();
    operatingResult.append(res);
    return operatingResult;
  }

  async provision(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('IoTHubProvision');
    const provisionIothubSelection: vscode.QuickPickItem[] = [
      {
        label: 'Select an existing IoT Hub',
        description: 'Select an existing IoT Hub',
        detail: 'select'
      },
      {
        label: 'Create a new IoT Hub',
        description: 'Create a new IoT Hub',
        detail: 'create'
      }
    ];
    const selection = await vscode.window.showQuickPick(
        provisionIothubSelection,
        {ignoreFocusOut: true, placeHolder: 'Provision IoT Hub'});

    if (!selection) {
      operatingResult.update(OperatingResultType.Canceled);
      return operatingResult;
    }

    const toolkit = getExtension(extensionName.Toolkit);
    if (toolkit === undefined) {
      operatingResult.update(OperatingResultType.Failed, 'Azure IoT Hub Toolkit is not installed. Please install it from Marketplace.');
      return operatingResult;
    }

    let iothub = null;
    const subscriptionId = AzureUtility.subscriptionId;
    const resourceGroup = AzureUtility.resourceGroup;

    switch (selection.detail) {
      case 'select':
        iothub = await toolkit.azureIoTExplorer.selectIoTHub(
            this.channel, subscriptionId);
        break;
      case 'create':
        if (this.channel) {
          this.channel.show();
          this.channel.appendLine('Creating new IoT Hub...');
        }

        iothub = await toolkit.azureIoTExplorer.createIoTHub(
            this.channel, subscriptionId, resourceGroup);
        break;
      default:
        break;
    }

    if (iothub && iothub.iotHubConnectionString) {
      if (this.channel) {
        this.channel.show();
        this.channel.appendLine(JSON.stringify(iothub, null, 2));
      }

      const sharedAccessKeyMatches =
          iothub.iotHubConnectionString.match(/SharedAccessKey=([^;]*)/);
      if (!sharedAccessKeyMatches || sharedAccessKeyMatches.length < 2) {
        operatingResult.update(OperatingResultType.Failed, 'Cannot parse shared access key from IoT Hub connection string. Please retry Azure Provision.');
        return operatingResult;
      }

      const sharedAccessKey = sharedAccessKeyMatches[1];

      const eventHubConnectionString = `Endpoint=${
          iothub.properties.eventHubEndpoints.events
              .endpoint};SharedAccessKeyName=iothubowner;SharedAccessKey=${
          sharedAccessKey}`;
      const eventHubConnectionPath =
          iothub.properties.eventHubEndpoints.events.path;

      await ConfigHandler.update(
          ConfigKey.iotHubConnectionString, iothub.iotHubConnectionString);
      await ConfigHandler.update(
          ConfigKey.eventHubConnectionString, eventHubConnectionString);
      await ConfigHandler.update(
          ConfigKey.eventHubConnectionPath, eventHubConnectionPath);

      const res = this.updateConfigSettings({
        values: {
          iotHubConnectionString: iothub.iotHubConnectionString,
          eventHubConnectionString,
          eventHubConnectionPath
        }
      });

      operatingResult.append(res);

      if (this.channel && operatingResult.isSucceded) {
        this.channel.show();
        this.channel.appendLine('IoT Hub provision succeeded.');
      }
    } else if (!iothub) {
      operatingResult.update(OperatingResultType.Failed, 'Cannot fetch IoT Hub information.');
    } else {
      operatingResult.update(OperatingResultType.Failed, 'IoT Hub provision failed. Please check output window for detail.');
    }
    return operatingResult;
  }

  updateConfigSettings(componentInfo?: ComponentInfo): OperatingResult {
    const operatingResult = new OperatingResult('IoTHubUpdateConfigSettings');
    const iotHubComponentIndex =
        this.azureConfigFileHandler.getComponentIndexById(this.id);

    if (iotHubComponentIndex > -1) {
      if (!componentInfo) {
        operatingResult.update(OperatingResultType.Failed, 'No component info provided.');
        return operatingResult;
      }

      try {
        this.azureConfigFileHandler.updateComponent(
          iotHubComponentIndex, componentInfo);
        operatingResult.update(OperatingResultType.Succeeded);
      } catch(error) {
        operatingResult.update(OperatingResultType.Failed, '[ERROR] ' + error.message);
      }

      return operatingResult;
    } else {
      const newIoTHubConfig: AzureComponentConfig = {
        id: this.id,
        folder: '',
        name: '',
        dependencies: [],
        type: ComponentType[this.componentType],
        componentInfo
      };

      try {
        this.azureConfigFileHandler.appendComponent(newIoTHubConfig);
        operatingResult.update(OperatingResultType.Succeeded);
      } catch(error) {
        operatingResult.update(OperatingResultType.Failed, '[ERROR] ' + error.message);
      }
      return operatingResult;
    }
  }
}