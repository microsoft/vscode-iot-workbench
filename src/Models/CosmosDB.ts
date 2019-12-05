import * as crypto from 'crypto';
import * as fs from 'fs-plus';
import {Guid} from 'guid-typescript';
import * as path from 'path';
import * as vscode from 'vscode';

import request = require('request-promise');
import rq = require('request');

import {AzureComponentsStorage, FileNames, ScaffoldType} from '../constants';

import {AzureComponentConfig, AzureConfigFileHandler, AzureConfigs, ComponentInfo, Dependency, DependencyConfig, DependencyType} from './AzureComponentConfig';
import {ARMTemplate, AzureUtility} from './AzureUtility';
import {Component, ComponentType} from './Interfaces/Component';
import {Provisionable} from './Interfaces/Provisionable';
import {channelShowAndAppendLine, channelPrintJsonObject} from '../utils';

export class CosmosDB implements Component, Provisionable {
  dependencies: DependencyConfig[] = [];
  private componentType: ComponentType;
  private channel: vscode.OutputChannel;
  private projectRootPath: string;
  private componentId: string;
  private azureConfigHandler: AzureConfigFileHandler;
  private extensionContext: vscode.ExtensionContext;
  private catchedCosmosDbList: Array<{name: string}> = [];
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

  async checkPrerequisites(): Promise<boolean> {
    return true;
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
          config => config.type === this.componentType);
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

  async create(): Promise<void> {
    await this.updateConfigSettings(ScaffoldType.Local);
  }

  async updateConfigSettings(type: ScaffoldType, componentInfo?: ComponentInfo):
      Promise<void> {
    const cosmosDBComponentIndex =
        await this.azureConfigHandler.getComponentIndexById(type, this.id);
    if (cosmosDBComponentIndex > -1) {
      if (!componentInfo) {
        return;
      }
      await this.azureConfigHandler.updateComponent(
          type, cosmosDBComponentIndex, componentInfo);
    } else {
      const newCosmosDBConfig: AzureComponentConfig = {
        id: this.id,
        folder: '',
        name: '',
        dependencies: this.dependencies,
        type: this.componentType
      };
      await this.azureConfigHandler.appendComponent(type, newCosmosDBConfig);
    }
  }

  async provision(): Promise<boolean> {
    const cosmosDbList = this.getCosmosDbInResourceGroup();
    const cosmosDbNameChoose = await vscode.window.showQuickPick(
        cosmosDbList, {placeHolder: 'Select Cosmos DB', ignoreFocusOut: true});
    if (!cosmosDbNameChoose) {
      return false;
    }

    let cosmosDbName = '';
    let cosmosDbKey = '';
    const scaffoldType = ScaffoldType.Workspace;

    if (!cosmosDbNameChoose.description) {
      if (this.channel) {
        channelShowAndAppendLine(this.channel, 'Creating Cosmos DB...');
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
      channelPrintJsonObject(this.channel, cosmosDBDeploy);

      for (const dependency of this.dependencies) {
        const componentConfig = await this.azureConfigHandler.getComponentById(
            scaffoldType, dependency.id);
        if (!componentConfig) {
          throw new Error(`Cannot find component with id ${dependency.id}.`);
        }
        if (dependency.type === DependencyType.Input) {
          // CosmosDB input
        } else {
          // CosmosDB output
        }
      }

      cosmosDbName =
          cosmosDBDeploy.properties.outputs.cosmosDBAccountName.value;
      cosmosDbKey = cosmosDBDeploy.properties.outputs.cosmosDBAccountKey.value;
    } else {
      if (this.channel) {
        channelShowAndAppendLine(this.channel, 'Creating Cosmos DB...');
      }

      cosmosDbName = cosmosDbNameChoose.label;
      const cosmosDbDetail = this.getCosmosDbByNameFromCache(cosmosDbName);
      if (cosmosDbDetail) {
        channelPrintJsonObject(this.channel, cosmosDbDetail);
      }
      cosmosDbKey = await this.getCosmosDbKey(cosmosDbName);
    }

    const databaseList = this.getDatabases(cosmosDbName, cosmosDbKey);
    const databaseChoose = await vscode.window.showQuickPick(
        databaseList, {placeHolder: 'Select Database', ignoreFocusOut: true});
    if (!databaseChoose) {
      return false;
    }

    let database: string|undefined = '';

    if (!databaseChoose.description) {
      database = await vscode.window.showInputBox({
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

      if (!database || !database.trim()) {
        return false;
      }
      database = database.trim();
      const cosmosDBApiRes =
          await this.ensureDatabase(cosmosDbName, cosmosDbKey, database);
      if (!cosmosDBApiRes) {
        throw new Error('Error occurred when create database.');
      }
    } else {
      database = databaseChoose.label;
    }

    const collectionList =
        this.getCollections(cosmosDbName, cosmosDbKey, database);
    const collectionChoose = await vscode.window.showQuickPick(
        collectionList,
        {placeHolder: 'Select Collection', ignoreFocusOut: true});
    if (!collectionChoose) {
      return false;
    }

    let collection: string|undefined = '';

    if (!collectionChoose.description) {
      collection = await vscode.window.showInputBox({
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

      if (!collection || !collection.trim()) {
        return false;
      }
      collection = collection.trim();
      const cosmosDBApiRes = await this.ensureCollection(
          cosmosDbName, cosmosDbKey, database, collection);
      if (!cosmosDBApiRes) {
        throw new Error('Error occurred when create collection.');
      }
    } else {
      collection = collectionChoose.label;
    }

    await this.updateConfigSettings(scaffoldType, {
      values: {
        subscriptionId: AzureUtility.subscriptionId as string,
        resourceGroup: AzureUtility.resourceGroup as string,
        cosmosDBAccountName: cosmosDbName,
        cosmosDBAccountKey: cosmosDbKey,
        cosmosDBDatabase: database,
        cosmosDBCollection: collection
      }
    });

    if (this.channel) {
      channelShowAndAppendLine(this.channel, 'Cosmos DB provision succeeded.');
    }
    return true;
  }

  private _getCosmosDBAuthorizationToken(
      key: string, verb: string, date: string, resourceType: string,
      resourceId: string) {
    const _key = Buffer.from(key, 'base64');
    const stringToSign =
        (`${verb}\n${resourceType}\n${resourceId}\n${date}\n\n`).toLowerCase();

    const body = Buffer.from(stringToSign, 'utf8');
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
      channelPrintJsonObject(this.channel, apiRes);
    }
    return apiRes;
  }

  async getDatabases(account: string, key: string) {
    const getDatabasesRes =
        await this._apiRequest(account, key, 'GET', 'dbs', 'dbs', '');
    const listRes = getDatabasesRes.body as {Databases: Array<{id: string}>};
    const databaseList: vscode.QuickPickItem[] =
        [{label: '$(plus) Create New Database', description: ''}];
    for (const item of listRes.Databases) {
      databaseList.push({label: item.id, description: account});
    }

    return databaseList;
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

  async getCollections(account: string, key: string, database: string) {
    const getDCollectionsRes = await this._apiRequest(
        account, key, 'GET', `dbs/${database}/colls`, 'colls',
        `dbs/${database}`);
    const listRes =
        getDCollectionsRes.body as {DocumentCollections: Array<{id: string}>};
    const collectionList: vscode.QuickPickItem[] =
        [{label: '$(plus) Create New Collection', description: ''}];
    for (const item of listRes.DocumentCollections) {
      collectionList.push(
          {label: item.id, description: `${account}/${database}`});
    }

    return collectionList;
  }

  async ensureCollection(
      account: string, key: string, database: string, collection: string) {
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

  private getCosmosDbByNameFromCache(name: string) {
    return this.catchedCosmosDbList.find(item => item.name === name);
  }

  private async getCosmosDbInResourceGroup() {
    const resource = `/subscriptions/${
        AzureUtility.subscriptionId}/resourceGroups/${
        AzureUtility
            .resourceGroup}/providers/Microsoft.DocumentDB/databaseAccounts?api-version=2015-04-08`;
    const cosmosDbListRes = await AzureUtility.getRequest(resource) as
        {value: Array<{name: string, location: string}>};
    const cosmosDbList: vscode.QuickPickItem[] =
        [{label: '$(plus) Create New Cosmos DB', description: ''}];
    for (const item of cosmosDbListRes.value) {
      cosmosDbList.push({label: item.name, description: item.location});
    }
    this.catchedCosmosDbList = cosmosDbListRes.value;
    return cosmosDbList;
  }

  private async getCosmosDbKey(name: string) {
    const resource = `/subscriptions/${
        AzureUtility.subscriptionId}/resourceGroups/${
        AzureUtility
            .resourceGroup}/providers/Microsoft.DocumentDB/databaseAccounts/${
        name}/listKeys?api-version=2015-04-08`;
    const cosmosDbKeyListRes =
        await AzureUtility.postRequest(resource) as {primaryMasterKey: string};
    return cosmosDbKeyListRes.primaryMasterKey;
  }
}