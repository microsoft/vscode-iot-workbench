// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import {Guid} from 'guid-typescript';
import * as path from 'path';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {AzureComponentsStorage, ConfigKey} from '../constants';

import {getExtension} from './Apis';
import {AzureComponentConfig, AzureConfigs} from './AzureComponentConfig';
import {extensionName} from './Interfaces/Api';
import {Component, ComponentType} from './Interfaces/Component';
import {Provisionable} from './Interfaces/Provisionable';

export class IoTHub implements Component, Provisionable {
  dependencies: string[] = [];
  private componentType: ComponentType;
  private channel: vscode.OutputChannel;
  private projectRootPath: string;
  private componentId: string;
  get id() {
    return this.componentId;
  }

  constructor(projectRoot: string, channel: vscode.OutputChannel) {
    this.componentType = ComponentType.IoTHub;
    this.channel = channel;
    this.componentId = Guid.create().toString();
    this.projectRootPath = projectRoot;
  }

  name = 'IoT Hub';

  getComponentType(): ComponentType {
    return this.componentType;
  }

  async load(): Promise<boolean> {
    const azureConfigFilePath = path.join(
        this.projectRootPath, AzureComponentsStorage.folderName,
        AzureComponentsStorage.fileName);

    if (!fs.existsSync(azureConfigFilePath)) {
      return false;
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
      return false;
    }
    return true;
  }


  async create(): Promise<boolean> {
    this.updateConfigSettings();
    return true;
  }

  async provision(): Promise<boolean> {
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
      return false;
    }

    const toolkit = getExtension(extensionName.Toolkit);
    if (toolkit === undefined) {
      const error = new Error(
          'Azure IoT Toolkit is not installed. Please install it from Marketplace.');
      throw error;
    }

    let iothub = null;
    switch (selection.detail) {
      case 'select':
        iothub = await toolkit.azureIoTExplorer.selectIoTHub(this.channel);
        break;
      case 'create':
        if (this.channel) {
          this.channel.show();
          this.channel.appendLine('Creating new IoT Hub...');
        }

        iothub = await toolkit.azureIoTExplorer.createIoTHub(this.channel);
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
        throw new Error(
            'Cannot parse shared access key from IoT Hub connection string. Please retry Azure Provision.');
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

      if (this.channel) {
        this.channel.show();
        this.channel.appendLine('IoT Hub provision succeeded.');
      }
      return true;
    } else if (!iothub) {
      return false;
    } else {
      throw new Error(
          'IoT Hub provision failed. Please check output window for detail.');
    }
  }

  private updateConfigSettings(): void {
    const azureConfigFilePath = path.join(
        this.projectRootPath, AzureComponentsStorage.folderName,
        AzureComponentsStorage.fileName);

    let azureConfigs: AzureConfigs = {componentConfigs: []};

    try {
      azureConfigs = JSON.parse(fs.readFileSync(azureConfigFilePath, 'utf8'));
    } catch (error) {
      const e = new Error('Invalid azure components config file.');
      throw e;
    }

    const iotHubConfig =
        azureConfigs.componentConfigs.find(config => config.id === (this.id));
    if (iotHubConfig) {
      // TODO: update the existing setting for the provision result
    } else {
      const newIoTHubConfig: AzureComponentConfig = {
        id: this.id,
        folder: '',
        name: '',
        dependencies: [],
        type: ComponentType[this.componentType]
      };
      azureConfigs.componentConfigs.push(newIoTHubConfig);
      fs.writeFileSync(
          azureConfigFilePath, JSON.stringify(azureConfigs, null, 4));
    }
  }
}