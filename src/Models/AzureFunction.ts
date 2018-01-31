'use strict';

import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import WebSiteManagementClient = require('azure-arm-website');
import {Component, ComponentType} from './Interfaces/Component';
import {Provisionable} from './Interfaces/Provisionable';
import {Deployable} from './Interfaces/Deployable';

import {ConfigHandler} from '../configHandler';
import {ConfigKey} from '../constants';

import {ServiceClientCredentials} from 'ms-rest';
import {AzureAccount, AzureResourceFilter} from '../azure-account.api';
import {StringDictionary} from 'azure-arm-website/lib/models';

export class AzureFunction implements Component, Provisionable {
  private componentType: ComponentType;
  private channel: vscode.OutputChannel;
  private azureFunctionPath: string;
  private azureAccountExtension: vscode.Extension<AzureAccount>|undefined =
      vscode.extensions.getExtension<AzureAccount>('ms-vscode.azure-account');

  private async getSubscriptionList(): Promise<vscode.QuickPickItem[]> {
    const subscriptionList: vscode.QuickPickItem[] = [];
    if (!this.azureAccountExtension) {
      throw new Error('Azure account extension is not found.');
    }

    const subscriptions = this.azureAccountExtension.exports.filters;
    subscriptions.forEach(item => {
      subscriptionList.push({
        label: item.subscription.displayName,
        description: item.subscription.subscriptionId
      } as vscode.QuickPickItem);
    });

    if (subscriptionList.length === 0) {
      throw new Error('No subscription found.');
    }

    return subscriptionList;
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
        this.azureAccountExtension.exports.filters;
    for (let i = 0; i < subscriptions.length; i++) {
      const subscription: AzureResourceFilter = subscriptions[i];
      if (subscription.subscription.subscriptionId === subscriptionId) {
        return subscription.session.credentials;
      }
    }

    return undefined;
  }

  constructor(azureFunctionPath: string, channel: vscode.OutputChannel) {
    this.componentType = ComponentType.AzureFunction;
    this.channel = channel;
    this.azureFunctionPath = azureFunctionPath;
  }

  getComponentType(): ComponentType {
    return this.componentType;
  }

  async load(): Promise<boolean> {
    return true;
  }

  async create(): Promise<boolean> {
    const azureFunctionPath = this.azureFunctionPath;
    console.log(azureFunctionPath);

    if (!fs.existsSync(azureFunctionPath)) {
      throw new Error(
          `Azure Function folder doesn't exist: ${azureFunctionPath}`);
    }

    try {
      await vscode.commands.executeCommand(
          'azureFunctions.createNewProject', azureFunctionPath, 'C#',
          false /* openFolder */);
      // .then(async () => {
      //   // We use one as value of cardinality in function.json, however, the
      //   // template doesn't support customized cardinality value currently,
      //   // the default value of cardinality is many
      //   setTimeout(async () => {
      //     await vscode.commands.executeCommand(
      //         'azureFunctions.createFunction', azureFunctionPath,
      //         'IoTHubTrigger-CSharp', 'IoTHubTrigger1',
      //         'eventHubConnectionString', '%eventHubConnectionPath%',
      //         '$Default');
      //   }, 3000);
      // });

      return true;
    } catch (error) {
      throw error;
    }
  }

  async provision(): Promise<boolean> {
    try {
      const subscription = await vscode.window.showQuickPick(
          this.getSubscriptionList(),
          {placeHolder: 'Select Subscription', ignoreFocusOut: true});
      if (!subscription) {
        return false;
      }
      const subscriptionId = subscription.description;
      const functionAppId: string|undefined =
          await vscode.commands.executeCommand<string>(
              'azureFunctions.createFunctionApp', subscriptionId);
      if (functionAppId) {
        ConfigHandler.update(ConfigKey.functionAppId, functionAppId);
        const eventHubConnectionString =
            ConfigHandler.get<string>(ConfigKey.eventHubConnectionString);
        const eventHubConnectionPath =
            ConfigHandler.get<string>(ConfigKey.eventHubConnectionPath);

        if (!eventHubConnectionString || !eventHubConnectionPath) {
          throw new Error('No event hub path or connection string found.');
        }
        const credential =
            await this.getCredentialFromSubscriptionId(subscriptionId);
        if (credential === undefined) {
          throw new Error('Cannot get credential.');
        }

        const resourceGroupMatches =
            functionAppId.match(/resourceGroups\/(.*?)\//);
        if (!resourceGroupMatches || resourceGroupMatches.length < 2) {
          throw new Error('Cannot parse resource group from function app ID.');
        }
        const resourceGroup = resourceGroupMatches[1];

        const siteNameMatches = functionAppId.match(/sites\/(.*?)[\/$]/);
        if (!siteNameMatches || siteNameMatches.length < 2) {
          throw new Error(
              'Cannot parse function app name from function app ID.');
        }
        const siteName = resourceGroupMatches[1];

        const client = new WebSiteManagementClient(credential, subscriptionId);
        const appSettings: StringDictionary =
            await client.webApps.listApplicationSettings(
                resourceGroup, siteName);
        appSettings.properties = appSettings.properties || {};
        appSettings.properties['eventHubConnectionString'] =
            eventHubConnectionString;
        appSettings.properties['eventHubConnectionPath'] =
            eventHubConnectionPath;

        await client.webApps.updateApplicationSettings(
            resourceGroup, siteName, appSettings);

        return true;
      } else {
        throw new Error('Provision Azure Function failed.');
      }
    } catch (error) {
      throw error;
    }
  }

  async deploy(): Promise<boolean> {
    try {
      const azureFunctionPath = this.azureFunctionPath;
      const functionAppId = ConfigHandler.get(ConfigKey.functionAppId);

      await vscode.commands.executeCommand(
          'azureFunctions.deploy', azureFunctionPath, functionAppId);
      return true;
    } catch (error) {
      throw error;
    }
  }

  async initialize(): Promise<boolean> {
    try {
      // await vscode.commands.executeCommand(
      //     'azureFunctions.createFunction', this.azureFunctionPath,
      //     'IoTHubTrigger-CSharp', 'IoTHubTrigger1',
      //     'eventHubConnectionString', '%eventHubConnectionPath%',
      //     '$Default');
      await vscode.commands.executeCommand(
          'azureFunctions.createFunction', this.azureFunctionPath,
          'HttpTrigger-CSharp', 'HttpTrigger1', 'DevKit', 'Anonymous');
      return true;
    } catch (error) {
      throw error;
    }
  }
}