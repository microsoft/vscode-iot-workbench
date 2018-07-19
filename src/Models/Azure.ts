import {ResourceManagementClient, ResourceModels, SubscriptionClient} from 'azure-arm-resource';
import * as crypto from 'crypto';
import * as fs from 'fs-plus';
import {ServiceClientCredentials} from 'ms-rest';
import * as path from 'path';
import * as vscode from 'vscode';

import request = require('request-promise');
import rq = require('request');

import {AzureAccount, AzureResourceFilter} from '../azure-account.api';
import {ConfigHandler} from '../configHandler';

import {getExtension} from './Apis';
import {extensionName} from './Interfaces/Api';
import {AzureComponentsStorage, ConfigKey} from '../constants';
import {AzureComponentConfig, AzureConfigs, ComponentInfo} from './AzureComponentConfig';
import {Component, ComponentType} from './Interfaces/Component';

export interface ARMParameters {
  [key: string]: {value: string|number|boolean|null};
}

export interface ARMParameterTemplateValue {
  type: string;
  defaultValue?: string|number|boolean|{}|Array<{}>|null;
  allowedValues?: Array<string|number|boolean|null>;
  minValue?: number;
  maxValue?: number;
  minLength?: number;
  maxLength?: number;
}

export interface ARMParameterTemplate {
  [key: string]: ARMParameterTemplateValue;
}

export interface ARMTemplate { parameters: ARMParameterTemplate; }

export class AzureComponent {
  private projectRootPath: string;
  private configFilePath: string;

  constructor(projectRoot: string) {
    this.projectRootPath = projectRoot;
    this.configFilePath = path.join(
        this.projectRootPath, AzureComponentsStorage.folderName,
        AzureComponentsStorage.fileName);
  }

  getAllComponents() {
    try {
      const azureConfigs =
          JSON.parse(fs.readFileSync(this.configFilePath, 'utf8')) as
          AzureConfigs;
      const components: AzureComponentConfig[] = [];
      const componentConfigs = azureConfigs.componentConfigs;
      const sortedComponentIds: string[] = [];
      let lastSortedCount = 0;

      do {
        lastSortedCount = components.length;
        for (const componentConfig of componentConfigs) {
          if (sortedComponentIds.indexOf(componentConfig.id) > -1) {
            continue;
          }

          let hold = false;
          for (const dependency of componentConfig.dependencies) {
            if (sortedComponentIds.indexOf(dependency) === -1) {
              hold = true;
              break;
            }
          }

          if (hold) {
            continue;
          }

          sortedComponentIds.push(componentConfig.id);
          components.push(componentConfig);
        }
      } while (lastSortedCount < componentConfigs.length &&
               lastSortedCount < components.length);
      return components;
    } catch (error) {
      throw new Error('Invalid azure components config file.');
    }
  }

  getComponentIndexById(id: string) {
    try {
      const azureConfigs =
          JSON.parse(fs.readFileSync(this.configFilePath, 'utf8')) as
          AzureConfigs;
      const componentIndex =
          azureConfigs.componentConfigs.findIndex(config => config.id === (id));
      return componentIndex;
    } catch (error) {
      throw new Error('Invalid azure components config file.');
    }
  }

  getComponentById(id: string) {
    try {
      const azureConfigs =
          JSON.parse(fs.readFileSync(this.configFilePath, 'utf8')) as
          AzureConfigs;
      const componentConfig =
          azureConfigs.componentConfigs.find(config => config.id === (id));
      return componentConfig;
    } catch (error) {
      throw new Error('Invalid azure components config file.');
    }
  }

  getComponentByType(type: ComponentType|string) {
    try {
      const azureConfigs =
          JSON.parse(fs.readFileSync(this.configFilePath, 'utf8')) as
          AzureConfigs;
      const componentConfig = azureConfigs.componentConfigs.find(
          config => config.type ===
              (typeof type === 'string' ? type : ComponentType[type]));
      return componentConfig;
    } catch (error) {
      throw new Error('Invalid azure components config file.');
    }
  }

  getComponentsByType(type: ComponentType|string) {
    try {
      const azureConfigs =
          JSON.parse(fs.readFileSync(this.configFilePath, 'utf8')) as
          AzureConfigs;
      const componentConfig = azureConfigs.componentConfigs.filter(
          config => config.type ===
              (typeof type === 'string' ? type : ComponentType[type]));
      return componentConfig;
    } catch (error) {
      throw new Error('Invalid azure components config file.');
    }
  }

  appendComponent(component: AzureComponentConfig) {
    try {
      const azureConfigs =
          JSON.parse(fs.readFileSync(this.configFilePath, 'utf8')) as
          AzureConfigs;
      azureConfigs.componentConfigs.push(component);
      fs.writeFileSync(
          this.configFilePath, JSON.stringify(azureConfigs, null, 4));
      return azureConfigs;
    } catch (error) {
      throw new Error('Invalid azure components config file.');
    }
  }

  updateComponent(index: number, componentInfo: ComponentInfo) {
    try {
      const azureConfigs =
          JSON.parse(fs.readFileSync(this.configFilePath, 'utf8')) as
          AzureConfigs;
      const component = azureConfigs.componentConfigs[index];
      if (!component) {
        throw new Error('Invalid index of componet list.');
      }
      component.componentInfo = componentInfo;
      fs.writeFileSync(
          this.configFilePath, JSON.stringify(azureConfigs, null, 4));
      return azureConfigs;
    } catch (error) {
      throw new Error('Invalid azure components config file.');
    }
  }
}

export class Azure {
  constructor(
      private _context: vscode.ExtensionContext,
      private _channel?: vscode.OutputChannel, subscriptionId?: string) {
    if (subscriptionId) {
      this._subscriptionId = subscriptionId;
    }
  }

  private _subscriptionId: string|undefined = undefined;
  private _resourceGroup: string|undefined = undefined;

  private _azureAccountExtension: AzureAccount|undefined =
      getExtension(extensionName.AzureAccount);

  private async _getSubscriptionList(): Promise<vscode.QuickPickItem[]> {
    const subscriptionList: vscode.QuickPickItem[] = [];
    if (!this._azureAccountExtension) {
      throw new Error('Azure account extension is not found.');
    }

    const subscriptions = this._azureAccountExtension.filters;
    subscriptions.forEach(item => {
      subscriptionList.push({
        label: item.subscription.displayName,
        description: item.subscription.subscriptionId
      } as vscode.QuickPickItem);
    });

    if (subscriptionList.length === 0) {
      subscriptionList.push({
        label: 'No subscription found',
        description: '',
        detail:
            'Click Azure account at bottom left corner and choose Select All'
      } as vscode.QuickPickItem);
    }

    return subscriptionList;
  }

  private _getCredentialBySubscriptionId(subscriptionId: string):
      ServiceClientCredentials|undefined {
    if (!this._azureAccountExtension) {
      throw new Error('Azure account extension is not found.');
    }

    const subscriptions: AzureResourceFilter[] =
        this._azureAccountExtension.filters;
    const subscription = subscriptions.find(
        sub => sub.subscription.subscriptionId === subscriptionId);
    if (subscription) {
      return subscription.session.credentials;
    }

    return undefined;
  }

  private async _getCredential(): Promise<ServiceClientCredentials|undefined> {
    this._subscriptionId = await this._getSubscription();

    if (!this._subscriptionId) {
      return undefined;
    }

    return this._getCredentialBySubscriptionId(this._subscriptionId);
  }

  private async _getResourceClient() {
    this._subscriptionId = await this._getSubscription();

    if (!this._subscriptionId) {
      return undefined;
    }

    const credential = await this._getCredential();
    if (credential) {
      const client =
          new ResourceManagementClient(credential, this._subscriptionId);
      return client;
    }
    return undefined;
  }

  private _getSubscriptionClientBySubscriptionId(substriptionId: string) {
    const credential = this._getCredentialBySubscriptionId(substriptionId);
    if (credential) {
      const client = new ResourceManagementClient(credential, substriptionId);
      return client;
    }
    return undefined;
  }

  private async _getSubscriptionClient() {
    const credential = await this._getCredential();
    if (credential) {
      const client = new SubscriptionClient(credential);
      return client;
    }
    return undefined;
  }

  private async _getLocations() {
    this._subscriptionId = await this._getSubscription();

    if (!this._subscriptionId) {
      return undefined;
    }

    const client = await this._getSubscriptionClient();
    if (!client) {
      return undefined;
    }

    const locations =
        await client.subscriptions.listLocations(this._subscriptionId);
    return locations;
  }

  private async _createResouceGroup() {
    const client = await this._getResourceClient();
    if (!client) {
      return undefined;
    }

    const resourceGroupName = await vscode.window.showInputBox({
      prompt: 'Input resouce group name',
      ignoreFocusOut: true,
      validateInput: async (name: string) => {
        if (!/^[a-z0-9_\-\.]*[a-z0-9_\-]+$/.test(name)) {
          return 'Resource group names only allow alphanumeric characters, periods, underscores, hyphens and parenthesis and cannot end in a period.';
        }

        const exist = await client.resourceGroups.checkExistence(name);
        if (exist) {
          return 'This name is unavailable';
        }

        return '';
      }
    });

    if (!resourceGroupName) {
      return undefined;
    }

    const locations = await this._getLocations();
    if (!locations) {
      return undefined;
    }
    const locationList: vscode.QuickPickItem[] = [];
    for (const location of locations) {
      locationList.push({
        label: location.displayName as string,
        description: location.name as string
      });
    }

    const resourceGroupLocation = await vscode.window.showQuickPick(
        locationList,
        {placeHolder: 'Select Resource Group Location', ignoreFocusOut: true});
    if (!resourceGroupLocation) {
      return undefined;
    }

    const resourceGroup = await client.resourceGroups.createOrUpdate(
        resourceGroupName, {location: resourceGroupLocation.description});

    return resourceGroup.name;
  }

  private _commonParameterCheck(
      _value: string, parameter: ARMParameterTemplateValue) {
    let value: string|number|boolean|null = null;
    switch (parameter.type.toLocaleLowerCase()) {
      case 'string':
        value = _value;
        break;
      case 'int':
        value = Number(_value);
        break;
      case 'bool':
        value = _value.toLocaleLowerCase() === 'true';
        break;
      default:
        break;
    }

    if (value === null) {
      return '';
    }

    if (typeof value === 'string' && parameter.minLength !== undefined &&
        parameter.minLength > value.length) {
      return `The value does\'t meet requirement: minLength ${
          parameter.minLength}.`;
    }

    if (typeof value === 'string' && parameter.maxLength !== undefined &&
        parameter.maxLength < value.length) {
      return `The value does\'t meet requirement: maxLength ${
          parameter.maxLength}.`;
    }

    if (typeof value === 'number' && parameter.minValue !== undefined &&
        parameter.minValue > value) {
      return `The value does\'t meet requirement: minValue ${
          parameter.minValue}.`;
    }

    if (typeof value === 'number' && parameter.maxValue !== undefined &&
        parameter.maxValue < value) {
      return `The value does\'t meet requirement: maxValue ${
          parameter.maxValue}.`;
    }

    if (typeof value === 'number' && isNaN(value)) {
      return `The value is not a valid number.`;
    }

    return '';
  }

  private _getKeyDisplayName(key: string) {
    key = key.replace(/^\$*/, '');
    const keyDisplayName = key.replace(/([A-Z][^A-Z])/g, ' $1');
    return keyDisplayName.substr(0, 1).toUpperCase() + keyDisplayName.substr(1);
  }

  private async _getARMParameters(
      parameterTemplate: ARMParameterTemplate, parameters?: ARMParameters) {
    parameters = parameters || {} as ARMParameters;
    for (const key of Object.keys(parameterTemplate)) {
      if (parameters.hasOwnProperty(key)) {
        continue;
      }

      const keyDisplayName = this._getKeyDisplayName(key);
      const parameter = parameterTemplate[key];
      let value: string|number|boolean|null = null;
      let inputValue = '';

      if (parameter.allowedValues) {
        const values: vscode.QuickPickItem[] = [];
        for (const value of parameter.allowedValues) {
          if (value !== null) {
            values.push({label: value.toString(), description: ''});
          }
        }

        const _value = await vscode.window.showQuickPick(values, {
          placeHolder: `Select value of ${keyDisplayName}`,
          ignoreFocusOut: true
        });
        if (!_value) {
          return undefined;
        }

        inputValue = _value.label;
      } else if (key.substr(0, 2) === '$$') {
        // Read value from file
        if (!vscode.workspace.workspaceFolders) {
          inputValue = '';
        } else {
          const _key = key.substr(2);
          const filePath = path.join(
              vscode.workspace.workspaceFolders[0].uri.fsPath, '..', _key);
          this._context.asAbsolutePath(_key);
          if (fs.existsSync(filePath)) {
            inputValue = fs.readFileSync(filePath, 'utf8');
          } else {
            inputValue = '';
          }
        }
      } else if (key.substr(0, 1) === '$') {
        // Read value from workspace config
        const _key = key.substr(1);

        const iothubConnectionString =
            ConfigHandler.get<string>('iothubConnectionString');

        switch (_key) {
          case 'iotHubName':
            if (!iothubConnectionString) {
              inputValue = '';
            } else {
              const iotHubNameMatches =
                  iothubConnectionString.match(/HostName=(.*?)\./);
              if (!iotHubNameMatches) {
                inputValue = '';
              } else {
                inputValue = iotHubNameMatches[1];
              }
            }
            break;
          case 'iotHubKeyName':
            if (!iothubConnectionString) {
              inputValue = '';
            } else {
              const iotHubKeyNameMatches = iothubConnectionString.match(
                  /SharedAccessKeyName=(.*?)(;|$)/);
              if (!iotHubKeyNameMatches) {
                inputValue = '';
              } else {
                inputValue = iotHubKeyNameMatches[1];
              }
            }
            break;
          case 'iotHubKey':
            if (!iothubConnectionString) {
              inputValue = '';
            } else {
              const iotHubKeyMatches =
                  iothubConnectionString.match(/SharedAccessKey=(.*?)(;|$)/);
              if (!iotHubKeyMatches) {
                inputValue = '';
              } else {
                inputValue = iotHubKeyMatches[1];
              }
            }
            break;
          case 'subscription':
            inputValue = this._subscriptionId || '';
            break;
          default:
            const _value = ConfigHandler.get<string>(_key);
            if (!_value) {
              inputValue = '';
            } else {
              inputValue = _value;
            }
        }
      } else {
        const _value = await vscode.window.showInputBox({
          prompt: `Input value for ${keyDisplayName}`,
          ignoreFocusOut: true,
          value: parameter.defaultValue ? parameter.defaultValue.toString() :
                                          '',
          validateInput: async (value: string) => {
            return this._commonParameterCheck(value, parameter);
          }
        });

        if (!_value) {
          return undefined;
        }

        inputValue = _value;
      }

      switch (parameter.type.toLocaleLowerCase()) {
        case 'string':
          value = inputValue;
          break;
        case 'int':
          value = Number(inputValue);
          break;
        case 'bool':
          value = inputValue.toLocaleLowerCase() === 'true';
          break;
        default:
          break;
      }

      parameters[key] = {value};
    }

    return parameters;
  }

  private async _getSubscription() {
    if (this._subscriptionId) {
      return this._subscriptionId;
    }

    const subscription = await vscode.window.showQuickPick(
        this._getSubscriptionList(),
        {placeHolder: 'Select Subscription', ignoreFocusOut: true});
    if (!subscription || !subscription.description) {
      return undefined;
    }
    return subscription.description;
  }

  private async _getResourceGroupItems() {
    const client = await this._getResourceClient();

    if (!client) {
      return [];
    }

    const resourceGrouplist: vscode.QuickPickItem[] =
        [{label: '$(plus) Create Resource Group', description: '', detail: ''}];

    const resourceGroups = await client.resourceGroups.list();

    for (const resourceGroup of resourceGroups) {
      resourceGrouplist.push({
        label: resourceGroup.name as string,
        description: resourceGroup.location,
        detail: ''
      });
    }

    return resourceGrouplist;
  }

  async getResourceGroup() {
    const client = await this._getResourceClient();

    if (!client) {
      this._resourceGroup = undefined;
      return undefined;
    }

    const choice = await vscode.window.showQuickPick(
        this._getResourceGroupItems(),
        {placeHolder: 'Select Resource Group', ignoreFocusOut: true});

    if (!choice) {
      this._resourceGroup = undefined;
      return undefined;
    }

    if (choice.description === '') {
      const resourceGroup = await this._createResouceGroup();
      this._resourceGroup = resourceGroup;
      return resourceGroup;
    } else {
      this._resourceGroup = choice.label;
      return choice.label;
    }
  }

  async deployARMTemplate(template: ARMTemplate, parameters?: ARMParameters) {
    const client = await this._getResourceClient();
    if (!client) {
      return undefined;
    }

    if (!this._resourceGroup) {
      return undefined;
    }

    parameters = await this._getARMParameters(template.parameters, parameters);
    if (!parameters) {
      return undefined;
    }

    let deployPendding: NodeJS.Timer|null = null;
    if (this._channel) {
      this._channel.show();
      this._channel.appendLine('Deploying Azure Resource...');
      deployPendding = setInterval(() => {
        if (this._channel) {
          this._channel.append('.');
        }
      }, 1000);
    }

    const mode = 'Incremental';
    const deploymentParameters:
        ResourceModels.Deployment = {properties: {parameters, template, mode}};

    try {
      const deployment = await client.deployments.createOrUpdate(
          this._resourceGroup, `IoTWorkbecnhDeploy${new Date().getTime()}`,
          deploymentParameters);

      if (this._channel && deployPendding) {
        clearInterval(deployPendding);
        this._channel.appendLine('.');
        this._channel.appendLine(JSON.stringify(deployment, null, 4));
      }
      return deployment;
    } catch (error) {
      if (this._channel && deployPendding) {
        clearInterval(deployPendding);
        this._channel.appendLine('.');
        this._channel.appendLine(error);
      }
      return undefined;
    }
  }

  get subscriptionId() {
    return this._subscriptionId;
  }

  get resourceGroup() {
    return this._resourceGroup;
  }

  getClient() {
    if (!this.subscriptionId) {
      return undefined;
    }

    const client =
        this._getSubscriptionClientBySubscriptionId(this.subscriptionId);
    if (!client) {
      return undefined;
    }

    return client;
  }
}

export class CosmosDB {
  constructor(
      private _account: string, private _key: string,
      private _channel?: vscode.OutputChannel) {}

  private _getCosmosDBAuthorizationToken(
      verb: string, date: string, resourceType: string, resourceId: string) {
    const key = new Buffer(this._key, 'base64');
    const stringToSign =
        (`${verb}\n${resourceType}\n${resourceId}\n${date}\n\n`).toLowerCase();

    const body = new Buffer(stringToSign, 'utf8');
    const signature =
        crypto.createHmac('sha256', key).update(body).digest('base64');

    const masterToken = 'master';
    const tokenVersion = '1.0';

    return encodeURIComponent(
        `type=${masterToken}&ver=${tokenVersion}&sig=${signature}`);
  }

  private _getRestHeaders(
      verb: string, resourceType: string, resourceId: string) {
    const date = new Date().toUTCString();
    const authorization = this._getCosmosDBAuthorizationToken(
        verb, date, resourceType, resourceId);
    const headers = {
      'Authorization': authorization,
      'Content-Type': 'application/json',
      'x-ms-date': date,
      'x-ms-version': '2017-02-22'
    };

    return headers;
  }

  private async _apiRequest(
      verb: string, path: string, resourceType: string, resourceId: string,
      body: {id: string}|null = null) {
    const apiUrl = `https://${this._account}.documents.azure.com/${path}`;
    const headers = this._getRestHeaders(verb, resourceType, resourceId);
    const apiRes: rq.Response = await request({
      method: verb,
      uri: apiUrl,
      headers,
      encoding: 'utf8',
      body,
      json: true,
      resolveWithFullResponse: true,
      simple: false
    });

    if (this._channel) {
      this._channel.show();
      this._channel.appendLine(JSON.stringify(apiRes, null, 2));
    }
    return apiRes;
  }

  async ensureDatabase(database: string) {
    const getDatabaseRes = await this._apiRequest(
        'GET', `dbs/${database}`, 'dbs', `dbs/${database}`);
    if (getDatabaseRes.statusCode === 200) {
      return true;
    }

    const createDatabaseRes =
        await this._apiRequest('POST', 'dbs', 'dbs', '', {id: database});
    if (createDatabaseRes.statusCode === 201) {
      return true;
    }

    return false;
  }

  async ensureCollection(database: string, collection: string) {
    const databaseRes = await this.ensureDatabase(database);
    if (!databaseRes) {
      return false;
    }

    const getCollectionRes = await this._apiRequest(
        'GET', `dbs/${database}/colls/${collection}`, 'colls',
        `dbs/${database}/colls/${collection}`);
    if (getCollectionRes.statusCode === 200) {
      return true;
    }

    const creatCollectionRes = await this._apiRequest(
        'POST', `dbs/${database}/colls`, 'colls', `dbs/${database}`,
        {id: collection});
    if (creatCollectionRes.statusCode === 201) {
      return true;
    }

    return false;
  }
}