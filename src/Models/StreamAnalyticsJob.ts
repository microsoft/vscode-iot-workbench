import * as fs from 'fs-plus';
import {Guid} from 'guid-typescript';
import * as path from 'path';
import * as vscode from 'vscode';

import {AzureComponentsStorage, FileNames} from '../constants';

import {ARMTemplate, Azure, AzureComponent} from './Azure';
import {AzureComponentConfig, AzureConfigs} from './AzureComponentConfig';
import {Component, ComponentType} from './Interfaces/Component';
import {Provisionable} from './Interfaces/Provisionable';

export class StreamAnalyticsJob implements Component, Provisionable {
  dependencies: string[] = [];
  private componentType: ComponentType;
  private channel: vscode.OutputChannel;
  private projectRootPath: string;
  private componentId: string;
  private azureComponent: AzureComponent;
  private extensionContext: vscode.ExtensionContext;
  get id() {
    return this.componentId;
  }

  constructor(
      context: vscode.ExtensionContext, projectRoot: string,
      channel: vscode.OutputChannel,
      dependencyComponents: Component[]|null = null) {
    this.componentType = ComponentType.StreamAnalyticsJob;
    this.channel = channel;
    this.componentId = Guid.create().toString();
    this.projectRootPath = projectRoot;
    this.azureComponent = new AzureComponent(projectRoot);
    this.extensionContext = context;
    if (dependencyComponents && dependencyComponents.length > 0) {
      dependencyComponents.forEach(
          component => this.dependencies.push(component.id));
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

  private updateConfigSettings(): void {
    const asaConfig = this.azureComponent.getComponentById(this.id);
    if (asaConfig) {
      // TODO: update the existing setting for the provision result
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
    const asaArmParameters = {
      query: {value: 'SELECT * FROM [input] INTO [output]'}
    };

    const asaDeploy =
        await azure.deployARMTemplate(asaArmTemplate, asaArmParameters);
    if (!asaDeploy || !asaDeploy.properties || !asaDeploy.properties.outputs ||
        !asaDeploy.properties.outputs.streamAnalyticsJobName) {
      throw new Error('Provision Stream Analytics Job failed.');
    }
    this.channel.appendLine(JSON.stringify(asaDeploy, null, 4));

    for (const id of this.dependencies) {
      const componentConfig = this.azureComponent.getComponentById(id);
      if (!componentConfig) {
        throw new Error(`Cannot find component with id ${id}.`);
      }

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
                  'streamanalytics-iothub.json'));
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
    }
    return true;
  }
}