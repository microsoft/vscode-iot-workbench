import * as fs from 'fs-plus';
import {Guid} from 'guid-typescript';
import * as path from 'path';
import * as vscode from 'vscode';

import {AzureComponentsStorage, FileNames} from '../constants';

import {ARMTemplate, Azure, AzureComponent} from './Azure';
import {AzureComponentConfig, AzureConfigs, ComponentInfo, Dependency, DependencyConfig, DependencyType} from './AzureComponentConfig';
import {Component, ComponentType} from './Interfaces/Component';
import {Deployable} from './Interfaces/Deployable';
import {Provisionable} from './Interfaces/Provisionable';

export class StreamAnalyticsJob implements Component, Provisionable,
                                           Deployable {
  dependencies: DependencyConfig[] = [];
  private componentType: ComponentType;
  private channel: vscode.OutputChannel;
  private projectRootPath: string;
  private componentId: string;
  private azureComponent: AzureComponent;
  private extensionContext: vscode.ExtensionContext;
  private queryPath: string;
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
    this.azureComponent = new AzureComponent(projectRoot);
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
    this.updateConfigSettings();
    return true;
  }

  private updateConfigSettings(componentInfo?: ComponentInfo): void {
    const asaComponentIndex =
        this.azureComponent.getComponentIndexById(this.id);
    if (asaComponentIndex > -1) {
      if (!componentInfo) {
        return;
      }
      this.azureComponent.updateComponent(asaComponentIndex, componentInfo);
    } else {
      const newAsaConfig: AzureComponentConfig = {
        id: this.id,
        folder: '',
        name: '',
        dependencies: this.dependencies,
        type: ComponentType[this.componentType]
      };
      this.azureComponent.appendComponent(newAsaConfig);
    }
  }

  async provision(azure: Azure): Promise<boolean> {
    const asaArmTemplatePath = this.extensionContext.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, 'arm', 'streamanalytics.json'));
    const asaArmTemplate =
        JSON.parse(fs.readFileSync(asaArmTemplatePath, 'utf8')) as ARMTemplate;

    const asaDeploy = await azure.deployARMTemplate(asaArmTemplate);
    if (!asaDeploy || !asaDeploy.properties || !asaDeploy.properties.outputs ||
        !asaDeploy.properties.outputs.streamAnalyticsJobName) {
      throw new Error('Provision Stream Analytics Job failed.');
    }
    this.channel.appendLine(JSON.stringify(asaDeploy, null, 4));

    for (const dependency of this.dependencies) {
      const componentConfig =
          this.azureComponent.getComponentById(dependency.id);
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
              streamAnalyticsJobName: {
                value: asaDeploy.properties.outputs.streamAnalyticsJobName.value
              },
              inputName: {value: `iothub-${componentConfig.id}`},
              iotHubName: {value: iotHubName},
              iotHubKeyName: {value: iotHubKeyName},
              iotHubKey: {value: iotHubKey}
            };

            const asaInputDeploy = await azure.deployARMTemplate(
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
        // asa output
      }
    }

    this.updateConfigSettings({
      values: {
        subscriptId: azure.subscriptionId as string,
        resourceGroup: azure.resourceGroup as string,
        streamAnalyticsJobName:
            asaDeploy.properties.outputs.streamAnalyticsJobName.value
      }
    });

    if (this.channel) {
      this.channel.show();
      this.channel.appendLine('Stream Analytics Job provision succeeded.');
    }
    return true;
  }

  async deploy(): Promise<boolean> {
    const componentConfig = this.azureComponent.getComponentById(this.id);
    if (!componentConfig) {
      throw new Error(`Cannot find component with id ${this.id}.`);
    }

    const componentInfo = componentConfig.componentInfo;
    if (!componentInfo) {
      throw new Error(`You must provision Stream Analytics Job first.`);
    }

    const subscriptId = componentInfo.values.subscriptId;
    const resourceGroup = componentInfo.values.resourceGroup;
    const streamAnalyticsJobName = componentInfo.values.streamAnalyticsJobName;
    const azure = new Azure(this.extensionContext, this.channel, subscriptId);
    const azureClient = azure.getClient();
    if (!azureClient) {
      throw new Error('Initialize Azure client failed.');
    }

    const resourceId = `/subscriptions/${subscriptId}/resourceGroups/${
        resourceGroup}/providers/Microsoft.StreamAnalytics/streamingjobs/${
        streamAnalyticsJobName}/transformations/Transformation`;
    const apiVersion = '2015-10-01';
    if (!fs.existsSync(this.queryPath)) {
      throw new Error(`Cannot find query file at ${this.queryPath}`);
    }
    const query = fs.readFileSync(this.queryPath, 'utf8');
    const parameters = {properties: {streamingUnits: 1, query}};

    let deployPendding: NodeJS.Timer|null = null;
    try {
      if (this.channel) {
        this.channel.show();
        this.channel.appendLine('Deploying Azure Functions App...');
        deployPendding = setInterval(() => {
          this.channel.append('.');
        }, 1000);
      }
      const deployment = await azureClient.resources.createOrUpdateById(
          resourceId, apiVersion, parameters);
      if (this.channel && deployPendding) {
        clearInterval(deployPendding);
        this.channel.appendLine('.');
        this.channel.appendLine(JSON.stringify(deployment, null, 4));
        this.channel.appendLine('Stream Analytics Job query deploy succeeded.');
      }
    } catch (error) {
      if (this.channel && deployPendding) {
        clearInterval(deployPendding);
        this.channel.appendLine('.');
      }
      throw error;
    }
    return true;
  }
}