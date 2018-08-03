import * as crypto from 'crypto';
import * as fs from 'fs-plus';
import {Guid} from 'guid-typescript';
import * as path from 'path';
import * as vscode from 'vscode';

import request = require('request-promise');
import rq = require('request');

import {AzureComponentsStorage, FileNames} from '../constants';

import {AzureComponentConfig, AzureConfigFileHandler, AzureConfigs, ComponentInfo, Dependency, DependencyConfig, DependencyType} from './AzureComponentConfig';
import {ARMTemplate, AzureUtility} from './AzureUtility';
import {Component, ComponentType} from './Interfaces/Component';
import {Provisionable} from './Interfaces/Provisionable';

export class CosmosDB implements Component, Provisionable {
  dependencies: DependencyConfig[] = [];
  private componentType: ComponentType;
  private channel: vscode.OutputChannel;
  private projectRootPath: string;
  private componentId: string;
  private azureConfigHandler: AzureConfigFileHandler;
  private extensionContext: vscode.ExtensionContext;
  get id() {
    return this.componentId;
  }

  constructor(
      context: vscode.ExtensionContext, projectRoot: string,
      channel: vscode.OutputChannel,
      dependencyComponents: Dependency[]|null = null) {
    this.componentType = ComponentType.CosmosDB;
    this.channel = channel;
    this.componentId = Guid.create().toString();
    this.projectRootPath = projectRoot;
    this.azureConfigHandler = new AzureConfigFileHandler(projectRoot);
    this.extensionContext = context;
    if (dependencyComponents && dependencyComponents.length > 0) {
      dependencyComponents.forEach(
          dependency => this.dependencies.push(
              {id: dependency.component.id, type: dependency.type}));
    }
  }

  name = 'Cosmos DB';

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
      const cosmosDBConfig = azureConfigs.componentConfigs.find(
          config => config.type === ComponentType[this.componentType]);
      if (cosmosDBConfig) {
        this.componentId = cosmosDBConfig.id;
        this.dependencies = cosmosDBConfig.dependencies;
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

  updateConfigSettings(componentInfo?: ComponentInfo): void {
    const cosmosDBComponentIndex =
        this.azureConfigHandler.getComponentIndexById(this.id);
    if (cosmosDBComponentIndex > -1) {
      if (!componentInfo) {
        return;
      }
      this.azureConfigHandler.updateComponent(
          cosmosDBComponentIndex, componentInfo);
    } else {
      const newCosmosDBConfig: AzureComponentConfig = {
        id: this.id,
        folder: '',
        name: '',
        dependencies: this.dependencies,
        type: ComponentType[this.componentType]
      };
      this.azureConfigHandler.appendComponent(newCosmosDBConfig);
    }
  }

  async provision(): Promise<boolean> {
    if (this.channel) {
      this.channel.show();
      this.channel.appendLine('Creating Cosmos DB...');
    }
    const cosmosDBArmTemplatePath = this.extensionContext.asAbsolutePath(
        path.join(FileNames.resourcesFolderName, 'arm', 'cosmosdb.json'));
    const cosmosDBArmTemplate =
        JSON.parse(fs.readFileSync(cosmosDBArmTemplatePath, 'utf8')) as
        ARMTemplate;

    const cosmosDBDeploy =
        await AzureUtility.deployARMTemplate(cosmosDBArmTemplate);
    if (!cosmosDBDeploy || !cosmosDBDeploy.properties ||
        !cosmosDBDeploy.properties.outputs ||
        !cosmosDBDeploy.properties.outputs.cosmosDBAccountName ||
        !cosmosDBDeploy.properties.outputs.cosmosDBAccountKey) {
      throw new Error('Provision Cosmos DB failed.');
    }
    this.channel.appendLine(JSON.stringify(cosmosDBDeploy, null, 4));

    for (const dependency of this.dependencies) {
      const componentConfig =
          this.azureConfigHandler.getComponentById(dependency.id);
      if (!componentConfig) {
        throw new Error(`Cannot find component with id ${dependency.id}.`);
      }
      if (dependency.type === DependencyType.Input) {
        // CosmosDB input
      } else {
        // CosmosDB output
      }
    }

    const account = cosmosDBDeploy.properties.outputs.cosmosDBAccountName.value;
    const key = cosmosDBDeploy.properties.outputs.cosmosDBAccountKey.value;

    let database = await vscode.window.showInputBox({
      prompt: `Input value for Cosmos DB Database`,
      ignoreFocusOut: true,
      validateInput: async (value: string) => {
        value = value.trim();
        if (!value) {
          return 'Please fill this field.';
        }
        if (!/^[^\\\/#\?]+/.test(value)) {
          return 'May not end with space nor contain "\\", "/", "#", "?".';
        }
        return;
      }
    });

    if (!database) {
      return false;
    }

    database = database.trim();

    let collection = await vscode.window.showInputBox({
      prompt: `Input value for Cosmos DB Collection`,
      ignoreFocusOut: true,
      validateInput: async (value: string) => {
        value = value.trim();
        if (!value) {
          return 'Please fill this field.';
        }
        if (!/^[^\\\/#\?]+/.test(value)) {
          return 'May not end with space nor contain "\\", "/", "#", "?".';
        }
        return;
      }
    });

    if (!collection) {
      return false;
    }

    collection = collection.trim();

    const cosmosDBApiRes =
        await this.ensureCollection(account, key, database, collection);
    if (!cosmosDBApiRes) {
      throw new Error('Error occurred when create collection.');
    }

    this.updateConfigSettings({
      values: {
        subscriptionId: AzureUtility.subscriptionId as string,
        resourceGroup: AzureUtility.resourceGroup as string,
        cosmosDBAccountName:
            cosmosDBDeploy.properties.outputs.cosmosDBAccountName.value,
        cosmosDBAccountKey:
            cosmosDBDeploy.properties.outputs.cosmosDBAccountKey.value,
        cosmosDBDatabase: database,
        cosmosDBCollection: collection
      }
    });

    if (this.channel) {
      this.channel.show();
      this.channel.appendLine('Cosmos DB provision succeeded.');
    }
    return true;
  }

  private _getCosmosDBAuthorizationToken(
      key: string, verb: string, date: string, resourceType: string,
      resourceId: string) {
    const _key = new Buffer(key, 'base64');
    const stringToSign =
        (`${verb}\n${resourceType}\n${resourceId}\n${date}\n\n`).toLowerCase();

    const body = new Buffer(stringToSign, 'utf8');
    const signature =
        crypto.createHmac('sha256', _key).update(body).digest('base64');

    const masterToken = 'master';
    const tokenVersion = '1.0';

    return encodeURIComponent(
        `type=${masterToken}&ver=${tokenVersion}&sig=${signature}`);
  }

  private _getRestHeaders(
      key: string, verb: string, resourceType: string, resourceId: string) {
    const date = new Date().toUTCString();
    const authorization = this._getCosmosDBAuthorizationToken(
        key, verb, date, resourceType, resourceId);
    const headers = {
      'Authorization': authorization,
      'Content-Type': 'application/json',
      'x-ms-date': date,
      'x-ms-version': '2017-02-22'
    };

    return headers;
  }

  private async _apiRequest(
      account: string, key: string, verb: string, path: string,
      resourceType: string, resourceId: string,
      body: {id: string}|null = null) {
    const apiUrl = `https://${account}.documents.azure.com/${path}`;
    const headers = this._getRestHeaders(key, verb, resourceType, resourceId);
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

    if (this.channel) {
      this.channel.show();
      this.channel.appendLine(JSON.stringify(apiRes, null, 2));
    }
    return apiRes;
  }

  async ensureDatabase(account: string, key: string, database: string) {
    const getDatabaseRes = await this._apiRequest(
        account, key, 'GET', `dbs/${database}`, 'dbs', `dbs/${database}`);
    if (getDatabaseRes.statusCode === 200) {
      return true;
    }

    const createDatabaseRes = await this._apiRequest(
        account, key, 'POST', 'dbs', 'dbs', '', {id: database});
    if (createDatabaseRes.statusCode === 201) {
      return true;
    }

    return false;
  }

  async ensureCollection(
      account: string, key: string, database: string, collection: string) {
    const databaseRes = await this.ensureDatabase(account, key, database);
    if (!databaseRes) {
      return false;
    }

    const getCollectionRes = await this._apiRequest(
        account, key, 'GET', `dbs/${database}/colls/${collection}`, 'colls',
        `dbs/${database}/colls/${collection}`);
    if (getCollectionRes.statusCode === 200) {
      return true;
    }

    const creatCollectionRes = await this._apiRequest(
        account, key, 'POST', `dbs/${database}/colls`, 'colls',
        `dbs/${database}`, {id: collection});
    if (creatCollectionRes.statusCode === 201) {
      return true;
    }

    return false;
  }
}