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
import {ConfigKey, AzureFunctionsLanguage, AzureComponentsStorage, DependentExtensions} from '../constants';
import {OperatingResultType, OperatingResult} from '../OperatingResult';

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

  static async isAvailable(): Promise<boolean> {
    if (!vscode.extensions.getExtension(DependentExtensions.azureFunctions)) {
      const choice = await vscode.window.showInformationMessage(
          'Azure Functions extension is required for the current project. Do you want to install it from marketplace?',
          'Yes', 'No');
      if (choice === 'Yes') {
        vscode.commands.executeCommand(
            'vscode.open',
            vscode.Uri.parse(
                'vscode:extension/' + DependentExtensions.azureFunctions));
      }
      return false;
    }

    return true;
  }

  async checkPrerequisites(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('AzureFunctionsCheckPrerequisites');
    const isFunctionsExtensionAvailable = await AzureFunctions.isAvailable();
    if (!isFunctionsExtensionAvailable) {
      operatingResult.update(OperatingResultType.Failed, 'Azure Fucntions extension is unavailable.');
      return operatingResult;
    }

    operatingResult.update(OperatingResultType.Succeeded);
    return operatingResult;
  }

  async load(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('AzureFunctionsLoad');
    const azureConfigFilePath = path.join(
        this.azureFunctionsPath, '..', AzureComponentsStorage.folderName,
        AzureComponentsStorage.fileName);

    if (!fs.existsSync(azureConfigFilePath)) {
      operatingResult.update(OperatingResultType.Failed, 'Azure Fucntions path in config file is not existing.');
      return operatingResult;
    }

    let azureConfigs: AzureConfigs;

    try {
      azureConfigs = JSON.parse(fs.readFileSync(azureConfigFilePath, 'utf8'));
    } catch (error) {
      operatingResult.update(OperatingResultType.Failed, '[ERROR] ' + error.message);;
      return operatingResult;
    }

    const azureFunctionsConfig = azureConfigs.componentConfigs.find(
        config => config.folder === this.functionFolder);
    if (azureFunctionsConfig) {
      this.componentId = azureFunctionsConfig.id;
      this.dependencies = azureFunctionsConfig.dependencies;
      if (azureFunctionsConfig.componentInfo) {
        this.functionLanguage =
            azureFunctionsConfig.componentInfo.values.functionLanguage;
      }

      // Load other information from config file.
    }

    operatingResult.update(OperatingResultType.Succeeded);
    return operatingResult;
  }

  async create(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('AzureFunctionsCreate');
    const azureFunctionsPath = this.azureFunctionsPath;
    console.log(azureFunctionsPath);

    if (!fs.existsSync(azureFunctionsPath)) {
      operatingResult.update(OperatingResultType.Failed, 'Unable to find the Azure Functions folder inside the project.');
      return operatingResult;
    }

    if (!this.functionLanguage) {
      const picks: vscode.QuickPickItem[] = [
        {label: AzureFunctionsLanguage.CSharpScript, description: ''},
        {label: AzureFunctionsLanguage.JavaScript, description: ''},
        {label: AzureFunctionsLanguage.CSharpLibrary, description: ''}
      ];

      const languageSelection = await vscode.window.showQuickPick(picks, {
        ignoreFocusOut: true,
        matchOnDescription: true,
        matchOnDetail: true,
        placeHolder: 'Select a language for Azure Functions',
      });

      if (!languageSelection) {
        operatingResult.update(OperatingResultType.Canceled, 'Unable to get the language for Azure Functions. Creating project for Azure Functions canceled.');
        return operatingResult;
      }
      this.functionLanguage = languageSelection.label;
    }

    const templateName =
        utils.getScriptTemplateNameFromLanguage(this.functionLanguage);
    if (!templateName) {
      operatingResult.update(OperatingResultType.Canceled, 'Unable to get the template for Azure Functions.Creating project for Azure Functions canceled.');
      return operatingResult;
    }

    try {
      if (this.functionLanguage === AzureFunctionsLanguage.CSharpLibrary) {
        await vscode.commands.executeCommand(
            'azureFunctions.createNewProject', azureFunctionsPath,
            this.functionLanguage, '~2', false /* openFolder */, templateName,
            'IoTHubTrigger1', {
              connection: 'eventHubConnectionString',
              path: '%eventHubConnectionPath%',
              consumerGroup: '$Default',
              namespace: 'IoTWorkbench'
            });
      } else {
        await vscode.commands.executeCommand(
            'azureFunctions.createNewProject', azureFunctionsPath,
            this.functionLanguage, '~1', false /* openFolder */, templateName,
            'IoTHubTrigger1', {
              connection: 'eventHubConnectionString',
              path: '%eventHubConnectionPath%',
              consumerGroup: '$Default'
            });
      }

      this.updateConfigSettings(
          {values: {functionLanguage: this.functionLanguage}});
      operatingResult.update(OperatingResultType.Succeeded);
      return operatingResult;
    } catch (error) {
      operatingResult.update(OperatingResultType.Failed, '[ERROR] Create Azure Functions failed: ' + error.message);
      return operatingResult;
    }
  }

  async provision(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('AzureFucntionsProvision');
    try {
      const subscriptionId = AzureUtility.subscriptionId;
      if (!subscriptionId) {
        operatingResult.update(OperatingResultType.Failed, 'Cannot get subscription ID.');
        return operatingResult;
      }

      const resourceGroup = AzureUtility.resourceGroup;
      if (!resourceGroup) {
        operatingResult.update(OperatingResultType.Failed, 'Cannot get resource group name.');
        return operatingResult;
      }

      const functionAppId: string|undefined =
          await vscode.commands.executeCommand<string>(
              'azureFunctions.createFunctionApp', subscriptionId,
              resourceGroup);
      if (functionAppId) {
        await ConfigHandler.update(ConfigKey.functionAppId, functionAppId);
        const eventHubConnectionString =
            ConfigHandler.get<string>(ConfigKey.eventHubConnectionString);
        const eventHubConnectionPath =
            ConfigHandler.get<string>(ConfigKey.eventHubConnectionPath);
        const iotHubConnectionString =
            ConfigHandler.get<string>(ConfigKey.iotHubConnectionString);

        if (!eventHubConnectionString || !eventHubConnectionPath) {
          operatingResult.update(OperatingResultType.Failed, 'No event hub path or connection string found.');
          return operatingResult;
        }
        const credential =
            await this.getCredentialFromSubscriptionId(subscriptionId);
        if (credential === undefined) {
          operatingResult.update(OperatingResultType.Failed, 'Unable to get credential for the subscription.');
          return operatingResult;
        }

        const resourceGroupMatches =
            functionAppId.match(/\/resourceGroups\/([^\/]*)/);
        if (!resourceGroupMatches || resourceGroupMatches.length < 2) {
          operatingResult.update(OperatingResultType.Failed, 'Cannot parse resource group from function app ID.');
          return operatingResult;
        }
        const resourceGroup = resourceGroupMatches[1];

        const siteNameMatches = functionAppId.match(/\/sites\/([^\/]*)/);
        if (!siteNameMatches || siteNameMatches.length < 2) {
          operatingResult.update(OperatingResultType.Failed, 'Cannot parse function app name from function app ID.');
          return operatingResult;
        }
        const siteName = siteNameMatches[1];

        const client = new WebSiteManagementClient(credential, subscriptionId);
        console.log(resourceGroup, siteName);
        const appSettings: StringDictionary =
            await client.webApps.listApplicationSettings(
                resourceGroup, siteName);
        console.log(appSettings);
        appSettings.properties = appSettings.properties || {};

        // for c# library, use the default setting of ~2.
        if (this.functionLanguage !==
            AzureFunctionsLanguage.CSharpLibrary as string) {
          appSettings.properties['FUNCTIONS_EXTENSION_VERSION'] = '~1';
        } else {
          appSettings.properties['FUNCTIONS_EXTENSION_VERSION'] = '~2';
        }
        appSettings.properties['eventHubConnectionString'] =
            eventHubConnectionString || '';
        appSettings.properties['eventHubConnectionPath'] =
            eventHubConnectionPath || '';
        appSettings.properties['iotHubConnectionString'] =
            iotHubConnectionString || '';
        // see detail:
        // https://github.com/Microsoft/vscode-iot-workbench/issues/436
        appSettings.properties['WEBSITE_RUN_FROM_PACKAGE'] = '0';

        await client.webApps.updateApplicationSettings(
            resourceGroup, siteName, appSettings);

        operatingResult.update(OperatingResultType.Succeeded);
        return operatingResult;
      } else {
        operatingResult.update(OperatingResultType.Failed, 'Cannot get function app ID.');
        return operatingResult;
      }
    } catch (error) {
      operatingResult.update(OperatingResultType.Failed, '[ERROR] Cannot provision Azure Functions: ' + error.message);
      return operatingResult;
    }
  }

  async deploy(): Promise<OperatingResult> {
    const operatingResult = new OperatingResult('AzureFunctionsDeploy');
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
      if (this.functionLanguage !==
          AzureFunctionsLanguage.CSharpLibrary as string) {
        await vscode.commands.executeCommand(
            'azureFunctions.deploy', azureFunctionsPath, functionAppId);
      } else {
        const subPath =
            path.join(azureFunctionsPath, 'bin/Release/netcoreapp2.1/publish');
        await vscode.commands.executeCommand(
            'azureFunctions.deploy', subPath, functionAppId);
      }
      console.log(azureFunctionsPath, functionAppId);

      if (this.channel && deployPending) {
        clearInterval(deployPending);
        this.channel.appendLine('.');
      }

      operatingResult.update(OperatingResultType.Succeeded);
      return operatingResult;
    } catch (error) {
      if (this.channel && deployPending) {
        clearInterval(deployPending);
        this.channel.appendLine('.');
      }

      operatingResult.update(OperatingResultType.Failed, '[ERROR] Cannot deploy Azure Functions: ' + error.message);
      return operatingResult;
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
        type: ComponentType[this.componentType],
        componentInfo
      };
      azureConfigs.componentConfigs.push(newAzureFunctionsConfig);
      fs.writeFileSync(
          azureConfigFilePath, JSON.stringify(azureConfigs, null, 4));
    }
  }
}