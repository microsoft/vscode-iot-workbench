import {ResourceManagementClient} from 'azure-arm-resource';
import * as fs from 'fs-plus';
import {Guid} from 'guid-typescript';
import * as path from 'path';
import * as vscode from 'vscode';

import {AzureComponentsStorage, FileNames, ScaffoldType} from '../constants';
import {channelShowAndAppendLine} from '../utils';

import {AzureComponentConfig, AzureConfigFileHandler, AzureConfigs, ComponentInfo, Dependency, DependencyConfig, DependencyType} from './AzureComponentConfig';
import {ARMTemplate, AzureUtility} from './AzureUtility';
import {Component, ComponentType} from './Interfaces/Component';
import {Deployable} from './Interfaces/Deployable';
import {Provisionable} from './Interfaces/Provisionable';

enum StreamAnalyticsAction {
  Start = 1,
  Stop
}

export class StreamAnalyticsJob implements Component, Provisionable,
                                           Deployable {
  dependencies: DependencyConfig[] = [];
  private componentType: ComponentType;
  private channel: vscode.OutputChannel;
  private projectRootPath: string;
  private componentId: string;
  private azureConfigHandler: AzureConfigFileHandler;
  private extensionContext: vscode.ExtensionContext;
  private queryPath: string;
  private subscriptionId: string|null = null;
  private resourceGroup: string|null = null;
  private streamAnalyticsJobName: string|null = null;
  private azureClient: ResourceManagementClient|null = null;
  private catchedStreamAnalyticsList: Array<{name: string}> = [];

  private async initAzureClient() {
    if (this.subscriptionId && this.resourceGroup &&
        this.streamAnalyticsJobName && this.azureClient) {
      return this.azureClient;
    }

    const componentConfig = await this.azureConfigHandler.getComponentById(
        ScaffoldType.Workspace, this.id);
    if (!componentConfig) {
      throw new Error(
          `Cannot find Azure Stream Analytics component with id ${this.id}.`);
    }

    const componentInfo = componentConfig.componentInfo;
    if (!componentInfo) {
      throw new Error(`You must provision Stream Analytics Job first.`);
    }

    const subscriptionId = componentInfo.values.subscriptionId;
    const resourceGroup = componentInfo.values.resourceGroup;
    const streamAnalyticsJobName = componentInfo.values.streamAnalyticsJobName;
    AzureUtility.init(this.extensionContext, this.channel, subscriptionId);
    const azureClient = AzureUtility.getClient();
    if (!azureClient) {
      throw new Error('Initialize Azure client failed.');
    }

    this.subscriptionId = subscriptionId;
    this.resourceGroup = resourceGroup;
    this.streamAnalyticsJobName = streamAnalyticsJobName;
    this.azureClient = azureClient;

    return azureClient;
  }

  private async callAction(action: StreamAnalyticsAction) {
    const actionResource = `/subscriptions/${
        this.subscriptionId}/resourceGroups/${
        this.resourceGroup}/providers/Microsoft.StreamAnalytics/streamingjobs/${
        this.streamAnalyticsJobName}/${
        StreamAnalyticsAction[action].toLowerCase()}?api-version=2015-10-01`;
    await AzureUtility.postRequest(actionResource);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        clearTimeout(timer);
        return resolve(false);
      }, 10 * 60 * 1000);

      const timer = setInterval(async () => {
        const state: string = await this.getState();
        if (action === StreamAnalyticsAction.Start && state === 'Running' ||
            action === StreamAnalyticsAction.Stop && state === 'Stopped' ||
            action === StreamAnalyticsAction.Stop && state === 'Created') {
          clearTimeout(timeout);
          clearInterval(timer);
          return resolve(true);
        }
      }, 5000);
    });
  }

  private getStreamAnalyticsByNameFromCache(name: string) {
    return this.catchedStreamAnalyticsList.find(item => item.name === name);
  }

  private async getStreamAnalyticsInResourceGroup() {
    const resource = `/subscriptions/${
        AzureUtility.subscriptionId}/resourceGroups/${
        AzureUtility
            .resourceGroup}/providers/Microsoft.StreamAnalytics/streamingjobs?api-version=2015-10-01`;
    const asaListRes = await AzureUtility.getRequest(resource) as
        {value: Array<{name: string, properties: {jobState: string}}>};
    const asaList: vscode.QuickPickItem[] =
        [{label: '$(plus) Create New Stream Analytics Job', description: ''}];
    for (const item of asaListRes.value) {
      asaList.push({label: item.name, description: item.properties.jobState});
    }

    this.catchedStreamAnalyticsList = asaListRes.value;
    return asaList;
  }

  get id() {
    return this.componentId;
  }

  constructor(
      queryPath: string, context: vscode.ExtensionContext, projectRoot: string,
      channel: vscode.OutputChannel,
      dependencyComponents: Dependency[]|null = null) {
    this.queryPath = queryPath;
    this.componentType = ComponentType.StreamAnalyticsJob;
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

  name = 'Stream Analytics Job';

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
      const asaConfig = azureConfigs.componentConfigs.find(
          config => config.type === ComponentType[this.componentType]);
      if (asaConfig) {
        this.componentId = asaConfig.id;
        this.dependencies = asaConfig.dependencies;
        // Load other information from config file.
      }
    } catch (error) {
      return false;
    }
    return true;
  }

  async create(): Promise<boolean> {
    const createTimeScaffoldType = ScaffoldType.Local;

    await this.updateConfigSettings(createTimeScaffoldType);
    return true;
  }

  async updateConfigSettings(type: ScaffoldType, componentInfo?: ComponentInfo):
      Promise<void> {
    const asaComponentIndex =
        await this.azureConfigHandler.getComponentIndexById(type, this.id);
    if (asaComponentIndex > -1) {
      if (!componentInfo) {
        return;
      }
      await this.azureConfigHandler.updateComponent(
          type, asaComponentIndex, componentInfo);
    } else {
      const newAsaConfig: AzureComponentConfig = {
        id: this.id,
        folder: '',
        name: '',
        dependencies: this.dependencies,
        type: ComponentType[this.componentType]
      };
      await this.azureConfigHandler.appendComponent(type, newAsaConfig);
    }
  }

  async provision(): Promise<boolean> {
    const scaffoldType = ScaffoldType.Workspace;

    const asaList = this.getStreamAnalyticsInResourceGroup();
    const asaNameChoose = await vscode.window.showQuickPick(
        asaList,
        {placeHolder: 'Select Stream Analytics Job', ignoreFocusOut: true});
    if (!asaNameChoose) {
      return false;
    }

    let streamAnalyticsJobName = '';

    if (!asaNameChoose.description) {
      if (this.channel) {
        channelShowAndAppendLine(
            this.channel, 'Creating Stream Analytics Job...');
      }
      const asaArmTemplatePath = this.extensionContext.asAbsolutePath(path.join(
          FileNames.resourcesFolderName, 'arm', 'streamanalytics.json'));
      const asaArmTemplate =
          JSON.parse(fs.readFileSync(asaArmTemplatePath, 'utf8')) as
          ARMTemplate;

      const asaDeploy = await AzureUtility.deployARMTemplate(asaArmTemplate);
      if (!asaDeploy || !asaDeploy.properties ||
          !asaDeploy.properties.outputs ||
          !asaDeploy.properties.outputs.streamAnalyticsJobName) {
        throw new Error('Provision Stream Analytics Job failed.');
      }
      channelShowAndAppendLine(
          this.channel, JSON.stringify(asaDeploy, null, 4));

      streamAnalyticsJobName =
          asaDeploy.properties.outputs.streamAnalyticsJobName.value;
    } else {
      if (this.channel) {
        channelShowAndAppendLine(
            this.channel, 'Creating Stream Analytics Job...');
      }
      streamAnalyticsJobName = asaNameChoose.label;
      const asaDetail =
          this.getStreamAnalyticsByNameFromCache(streamAnalyticsJobName);
      if (asaDetail) {
        channelShowAndAppendLine(
            this.channel, JSON.stringify(asaDetail, null, 4));
      }
    }

    for (const dependency of this.dependencies) {
      const componentConfig = await this.azureConfigHandler.getComponentById(
          scaffoldType, dependency.id);
      if (!componentConfig) {
        throw new Error(`Cannot find component with id ${dependency.id}.`);
      }

      if (dependency.type === DependencyType.Input) {
        switch (componentConfig.type) {
          case 'IoTHub': {
            if (!componentConfig.componentInfo) {
              return false;
            }
            const iotHubConnectionString =
                componentConfig.componentInfo.values.iotHubConnectionString;
            let iotHubName = '';
            let iotHubKeyName = '';
            let iotHubKey = '';
            const iotHubNameMatches =
                iotHubConnectionString.match(/HostName=(.*?)\./);
            const iotHubKeyMatches =
                iotHubConnectionString.match(/SharedAccessKey=(.*?)(;|$)/);
            const iotHubKeyNameMatches =
                iotHubConnectionString.match(/SharedAccessKeyName=(.*?)(;|$)/);
            if (iotHubNameMatches) {
              iotHubName = iotHubNameMatches[1];
            }
            if (iotHubKeyMatches) {
              iotHubKey = iotHubKeyMatches[1];
            }
            if (iotHubKeyNameMatches) {
              iotHubKeyName = iotHubKeyNameMatches[1];
            }

            if (!iotHubName || !iotHubKeyName || !iotHubKey) {
              throw new Error('Cannot parse IoT Hub connection string.');
            }

            const asaIoTHubArmTemplatePath =
                this.extensionContext.asAbsolutePath(path.join(
                    FileNames.resourcesFolderName, 'arm',
                    'streamanalytics-input-iothub.json'));
            const asaIoTHubArmTemplate =
                JSON.parse(fs.readFileSync(asaIoTHubArmTemplatePath, 'utf8')) as
                ARMTemplate;
            const asaIotHubArmParameters = {
              streamAnalyticsJobName: {value: streamAnalyticsJobName},
              inputName: {value: `iothub-${componentConfig.id}`},
              iotHubName: {value: iotHubName},
              iotHubKeyName: {value: iotHubKeyName},
              iotHubKey: {value: iotHubKey}
            };

            const asaInputDeploy = await AzureUtility.deployARMTemplate(
                asaIoTHubArmTemplate, asaIotHubArmParameters);
            if (!asaInputDeploy) {
              throw new Error('Provision Stream Analytics Job failed.');
            }

            break;
          }
          default: {
            throw new Error(
                `Not supported ASA input type: ${componentConfig.type}.`);
          }
        }
      } else {
        switch (componentConfig.type) {
          case 'CosmosDB': {
            if (!componentConfig.componentInfo) {
              return false;
            }
            const cosmosDBAccountName =
                componentConfig.componentInfo.values.cosmosDBAccountName;
            const cosmosDBDatabase =
                componentConfig.componentInfo.values.cosmosDBDatabase;
            const cosmosDBCollection =
                componentConfig.componentInfo.values.cosmosDBCollection;
            if (!cosmosDBAccountName || !cosmosDBDatabase ||
                !cosmosDBCollection) {
              throw new Error('Cannot get Cosmos DB connection information.');
            }

            const asaCosmosDBArmTemplatePath =
                this.extensionContext.asAbsolutePath(path.join(
                    FileNames.resourcesFolderName, 'arm',
                    'streamanalytics-output-cosmosdb.json'));
            const asaCosmosDBArmTemplate =
                JSON.parse(fs.readFileSync(
                    asaCosmosDBArmTemplatePath, 'utf8')) as ARMTemplate;
            const asaCosmosArmParameters = {
              streamAnalyticsJobName: {value: streamAnalyticsJobName},
              outputName: {value: `cosmosdb-${componentConfig.id}`},
              cosmosDBName: {value: cosmosDBAccountName},
              cosmosDBDatabase: {value: cosmosDBDatabase},
              cosmosDBCollection: {value: cosmosDBCollection}
            };

            const asaOutputDeploy = await AzureUtility.deployARMTemplate(
                asaCosmosDBArmTemplate, asaCosmosArmParameters);
            if (!asaOutputDeploy) {
              throw new Error('Provision Stream Analytics Job failed.');
            }

            break;
          }
          default: {
            throw new Error(
                `Not supported ASA output type: ${componentConfig.type}.`);
          }
        }
      }
    }

    await this.updateConfigSettings(scaffoldType, {
      values: {
        subscriptionId: AzureUtility.subscriptionId as string,
        resourceGroup: AzureUtility.resourceGroup as string,
        streamAnalyticsJobName
      }
    });

    if (this.channel) {
      channelShowAndAppendLine(
          this.channel, 'Stream Analytics Job provision succeeded.');
    }
    return true;
  }

  async deploy(): Promise<boolean> {
    const azureClient = this.azureClient || await this.initAzureClient();

    // Stop Job
    let stopPending: NodeJS.Timer|null = null;
    if (this.channel) {
      channelShowAndAppendLine(
          this.channel, 'Stopping Stream Analytics Job...');
      stopPending = setInterval(() => {
        this.channel.append('.');
      }, 1000);
    }
    const jobStopped = await this.stop();
    if (!jobStopped) {
      if (this.channel) {
        channelShowAndAppendLine(
            this.channel, 'Stop Stream Analytics Job failed.');
      }
      return false;
    } else {
      if (this.channel && stopPending) {
        clearInterval(stopPending);
        channelShowAndAppendLine(this.channel, '.');
        channelShowAndAppendLine(
            this.channel, 'Stop Stream Analytics Job succeeded.');
      }
    }

    const resourceId = `/subscriptions/${this.subscriptionId}/resourceGroups/${
        this.resourceGroup}/providers/Microsoft.StreamAnalytics/streamingjobs/${
        this.streamAnalyticsJobName}/transformations/Transformation`;
    const apiVersion = '2015-10-01';
    if (!fs.existsSync(this.queryPath)) {
      throw new Error(`Cannot find query file at ${this.queryPath}`);
    }
    const query = fs.readFileSync(this.queryPath, 'utf8');
    const parameters = {properties: {streamingUnits: 1, query}};

    let deployPending: NodeJS.Timer|null = null;
    try {
      if (this.channel) {
        channelShowAndAppendLine(
            this.channel, 'Deploying Stream Analytics Job...');
        deployPending = setInterval(() => {
          this.channel.append('.');
        }, 1000);
      }
      const deployment = await azureClient.resources.createOrUpdateById(
          resourceId, apiVersion, parameters);
      if (this.channel && deployPending) {
        clearInterval(deployPending);
        channelShowAndAppendLine(this.channel, '.');
        channelShowAndAppendLine(
            this.channel, JSON.stringify(deployment, null, 4));
        channelShowAndAppendLine(
            this.channel, 'Stream Analytics Job query deploy succeeded.');
      }

      // Start Job
      let startPending: NodeJS.Timer|null = null;
      if (this.channel) {
        channelShowAndAppendLine(
            this.channel, 'Starting Stream Analytics Job...');
        startPending = setInterval(() => {
          this.channel.append('.');
        }, 1000);
      }
      const jobStarted = await this.start();
      if (!jobStarted) {
        if (this.channel) {
          channelShowAndAppendLine(
              this.channel, 'Start Stream Analytics Job failed.');
        }
        return false;
      } else if (this.channel && startPending) {
        clearInterval(startPending);
        channelShowAndAppendLine(this.channel, '.');
        channelShowAndAppendLine(
            this.channel, 'Start Stream Analytics Job succeeded.');
      }
    } catch (error) {
      if (this.channel && deployPending) {
        clearInterval(deployPending);
        channelShowAndAppendLine(this.channel, '.');
      }
      throw error;
    }
    return true;
  }

  async stop() {
    return await this.callAction(StreamAnalyticsAction.Stop);
  }

  async start() {
    return await this.callAction(StreamAnalyticsAction.Start);
  }

  async getState() {
    const azureClient = this.azureClient || await this.initAzureClient();

    const resourceId = `/subscriptions/${this.subscriptionId}/resourceGroups/${
        this.resourceGroup}/providers/Microsoft.StreamAnalytics/streamingjobs/${
        this.streamAnalyticsJobName}`;
    const apiVersion = '2015-10-01';
    const res = await azureClient.resources.getById(resourceId, apiVersion);
    return res.properties.jobState;
  }
}