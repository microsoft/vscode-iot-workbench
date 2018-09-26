// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import * as utils from '../utils';
import WebSiteManagementClient = require('azure-arm-website');
import {Component, ComponentType} from './Interfaces/Component';
import {Provisionable} from './Interfaces/Provisionable';
import {Deployable} from './Interfaces/Deployable';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, AzureFunctionsLanguage, AzureComponentsStorage} from '../constants';

import {ServiceClientCredentials} from 'ms-rest';
import {AzureAccount, AzureResourceFilter} from '../azure-account.api';
import {StringDictionary} from 'azure-arm-website/lib/models';
import {getExtension} from './Apis';
import {extensionName} from './Interfaces/Api';
import {Guid} from 'guid-typescript';
import {AzureComponentConfig, AzureConfigs, ComponentInfo, DependencyConfig, Dependency} from './AzureComponentConfig';
import {AzureUtility} from './AzureUtility';

export class AzureFunctions implements Component, Provisionable, Deployable {
  dependencies: DependencyConfig[] = [];
  private componentType: ComponentType;
  private channel: vscode.OutputChannel;
  private azureFunctionsPath: string;
  private azureAccountExtension: AzureAccount|undefined =
      getExtension(extensionName.AzureAccount);
  private functionLanguage: string|null;
  private functionFolder: string;

  private componentId: string;
  get id() {
    return this.componentId;
  }

  private async getCredentialFromSubscriptionId(subscriptionId: string):
      Promise<ServiceClientCredentials|undefined> {
    if (!this.azureAccountExtension) {
      throw new Error('Azure account extension is not found.');
    }

    if (!subscriptionId) {
      throw new Error('Subscription ID is required.');
    }

    const subscriptions: AzureResourceFilter[] =
        this.azureAccountExtension.filters;
    for (let i = 0; i < subscriptions.length; i++) {
      const subscription: AzureResourceFilter = subscriptions[i];
      if (subscription.subscription.subscriptionId === subscriptionId) {
        return subscription.session.credentials;
      }
    }

    return undefined;
  }

  constructor(
      azureFunctionsPath: string, functionFolder: string,
      channel: vscode.OutputChannel, language: string|null = null,
      dependencyComponents: Dependency[]|null = null) {
    this.componentType = ComponentType.AzureFunctions;
    this.channel = channel;
    this.azureFunctionsPath = azureFunctionsPath;
    this.functionLanguage = language;
    this.functionFolder = functionFolder;
    this.componentId = Guid.create().toString();
    if (dependencyComponents && dependencyComponents.length > 0) {
      dependencyComponents.forEach(
          dependency => this.dependencies.push(
              {id: dependency.component.id.toString(), type: dependency.type}));
    }
  }

  name = 'Azure Functions';

  getComponentType(): ComponentType {
    return this.componentType;
  }

  async load(): Promise<boolean> {
    const azureConfigFilePath = path.join(
        this.azureFunctionsPath, '..', AzureComponentsStorage.folderName,
        AzureComponentsStorage.fileName);

    if (!fs.existsSync(azureConfigFilePath)) {
      return false;
    }

    let azureConfigs: AzureConfigs;

    try {
      azureConfigs = JSON.parse(fs.readFileSync(azureConfigFilePath, 'utf8'));
    } catch (error) {
      return false;
    }

    const azureFunctionsConfig = azureConfigs.componentConfigs.find(
        config => config.folder === this.functionFolder);
    if (azureFunctionsConfig) {
      this.componentId = azureFunctionsConfig.id;
      this.dependencies = azureFunctionsConfig.dependencies;

      // Load other information from config file.
    }
    return true;
  }

  async create(): Promise<boolean> {
    const azureFunctionsPath = this.azureFunctionsPath;
    console.log(azureFunctionsPath);

    if (!fs.existsSync(azureFunctionsPath)) {
      throw new Error(
          'Unable to find the Azure Functions folder inside the project.');
    }

    if (!this.functionLanguage) {
      const picks: vscode.QuickPickItem[] = [
        {label: AzureFunctionsLanguage.CSharpScript, description: ''},
        {label: AzureFunctionsLanguage.JavaScript, description: ''}
      ];

      const languageSelection = await vscode.window.showQuickPick(picks, {
        ignoreFocusOut: true,
        matchOnDescription: true,
        matchOnDetail: true,
        placeHolder: 'Select a language for Azure Functions',
      });

      if (!languageSelection) {
        throw new Error(
            'Unable to get the language for Azure Functions. Creating project for Azure Functions canceled.');
      }
      this.functionLanguage = languageSelection.label;
    }

    const templateName =
        utils.getScriptTemplateNameFromLanguage(this.functionLanguage);
    if (!templateName) {
      throw new Error(
          'Unable to get the template for Azure Functions.Creating project for Azure Functions canceled.');
    }

    try {
      await vscode.commands.executeCommand(
          'azureFunctions.createNewProject', azureFunctionsPath,
          this.functionLanguage, '~1', false /* openFolder */, templateName,
          'IoTHubTrigger1', {
            connection: 'eventHubConnectionString',
            path: '%eventHubConnectionPath%',
            consumerGroup: '$Default'
          });
      this.updateConfigSettings();
      return true;
    } catch (error) {
      throw error;
    }
  }

  async provision(): Promise<boolean> {
    try {
      const subscriptionId = AzureUtility.subscriptionId;
      if (!subscriptionId) {
        return false;
      }
      const functionAppId: string|undefined =
          await vscode.commands.executeCommand<string>(
              'azureFunctions.createFunctionApp', subscriptionId);
      if (functionAppId) {
        await ConfigHandler.update(ConfigKey.functionAppId, functionAppId);
        const eventHubConnectionString =
            ConfigHandler.get<string>(ConfigKey.eventHubConnectionString);
        const eventHubConnectionPath =
            ConfigHandler.get<string>(ConfigKey.eventHubConnectionPath);
        const iotHubConnectionString =
            ConfigHandler.get<string>(ConfigKey.iotHubConnectionString);

        if (!eventHubConnectionString || !eventHubConnectionPath) {
          throw new Error('No event hub path or connection string found.');
        }
        const credential =
            await this.getCredentialFromSubscriptionId(subscriptionId);
        if (credential === undefined) {
          throw new Error('Unable to get credential for the subscription.');
        }

        const resourceGroupMatches =
            functionAppId.match(/\/resourceGroups\/([^\/]*)/);
        if (!resourceGroupMatches || resourceGroupMatches.length < 2) {
          throw new Error('Cannot parse resource group from function app ID.');
        }
        const resourceGroup = resourceGroupMatches[1];

        const siteNameMatches = functionAppId.match(/\/sites\/([^\/]*)/);
        if (!siteNameMatches || siteNameMatches.length < 2) {
          throw new Error(
              'Cannot parse function app name from function app ID.');
        }
        const siteName = siteNameMatches[1];

        const client = new WebSiteManagementClient(credential, subscriptionId);
        console.log(resourceGroup, siteName);
        const appSettings: StringDictionary =
            await client.webApps.listApplicationSettings(
                resourceGroup, siteName);
        console.log(appSettings);
        appSettings.properties = appSettings.properties || {};
        appSettings.properties['FUNCTIONS_EXTENSION_VERSION'] = '~1';
        appSettings.properties['eventHubConnectionString'] =
            eventHubConnectionString || '';
        appSettings.properties['eventHubConnectionPath'] =
            eventHubConnectionPath || '';
        appSettings.properties['iotHubConnectionString'] =
            iotHubConnectionString || '';
        // see detail: https://github.com/Microsoft/vscode-iot-workbench/issues/436
        appSettings.properties['WEBSITE_RUN_FROM_PACKAGE'] = '0';

        await client.webApps.updateApplicationSettings(
            resourceGroup, siteName, appSettings);

        return true;
      } else {
        throw new Error(
            'Unable to create Azure Functions application. Please check the error and retry.');
      }
    } catch (error) {
      throw error;
    }
  }

  async deploy(): Promise<boolean> {
    let deployPending: NodeJS.Timer|null = null;
    if (this.channel) {
      this.channel.show();
      this.channel.appendLine('Deploying Azure Functions App...');
      deployPending = setInterval(() => {
        this.channel.append('.');
      }, 1000);
    }

    try {
      const azureFunctionsPath = this.azureFunctionsPath;
      const functionAppId = ConfigHandler.get(ConfigKey.functionAppId);

      await vscode.commands.executeCommand(
          'azureFunctions.deploy', azureFunctionsPath, functionAppId);
      console.log(azureFunctionsPath, functionAppId);
      if (this.channel && deployPending) {
        clearInterval(deployPending);
        this.channel.appendLine('.');
      }
      return true;
    } catch (error) {
      if (this.channel && deployPending) {
        clearInterval(deployPending);
        this.channel.appendLine('.');
      }
      throw error;
    }
  }

  updateConfigSettings(componentInfo?: ComponentInfo): void {
    const azureConfigFilePath = path.join(
        this.azureFunctionsPath, '..', AzureComponentsStorage.folderName,
        AzureComponentsStorage.fileName);

    let azureConfigs: AzureConfigs = {componentConfigs: []};

    try {
      azureConfigs = JSON.parse(fs.readFileSync(azureConfigFilePath, 'utf8'));
    } catch (error) {
      const e = new Error('Invalid azure components config file.');
      throw e;
    }

    const azureFunctionsConfig =
        azureConfigs.componentConfigs.find(config => config.id === (this.id));
    if (azureFunctionsConfig) {
      // TODO: update the existing setting for the provision result
    } else {
      const newAzureFunctionsConfig: AzureComponentConfig = {
        id: this.id,
        folder: this.functionFolder,
        name: '',
        dependencies: this.dependencies,
        type: ComponentType[this.componentType]
      };
      azureConfigs.componentConfigs.push(newAzureFunctionsConfig);
      fs.writeFileSync(
          azureConfigFilePath, JSON.stringify(azureConfigs, null, 4));
    }
  }
}