import { ResourceManagementClient, ResourceModels, SubscriptionClient, SubscriptionModels } from 'azure-arm-resource';
import * as fs from 'fs-plus';
import { HttpMethods, WebResource } from 'ms-rest';
import * as path from 'path';
import * as vscode from 'vscode';

import { channelPrintJsonObject, channelShowAndAppendLine } from '../utils';

import request = require('request-promise');
import rq = require('request');

import { AzureAccount, AzureResourceFilter, AzureSession } from '../azure-account.api';
import { ConfigHandler } from '../configHandler';

import { getExtension } from './Apis';
import { ExtensionName } from './Interfaces/Api';
import { TelemetryWorker } from '../telemetry';
import { EventNames } from '../constants';

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

export interface ARMTemplate { 
  parameters: ARMParameterTemplate;
}

export class AzureUtility {
  private static _context: vscode.ExtensionContext;
  private static _channel: vscode.OutputChannel|undefined;
  private static _subscriptionId: string|undefined;
  private static _resourceGroup: string|undefined;
  private static _azureAccountExtension: AzureAccount|undefined =
      getExtension(ExtensionName.AzureAccount);

  static init(
    context: vscode.ExtensionContext, channel?: vscode.OutputChannel,
    subscriptionId?: string): void {
    AzureUtility._context = context;
    AzureUtility._channel = channel;
    AzureUtility._subscriptionId = subscriptionId;
  }

  private static async _getSubscriptionList(): Promise<vscode.QuickPickItem[]> {
    const subscriptionList: vscode.QuickPickItem[] = [];
    if (!AzureUtility._azureAccountExtension) {
      throw new Error('Azure account extension is not found.');
    }

    const subscriptions = AzureUtility._azureAccountExtension.filters;
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

  private static _getSessionBySubscriptionId(subscriptionId: string):
      AzureSession|undefined {
    if (!AzureUtility._azureAccountExtension) {
      throw new Error('Azure account extension is not found.');
    }

    const subscriptions: AzureResourceFilter[] =
        AzureUtility._azureAccountExtension.filters;
    const subscription = subscriptions.find(
      sub => sub.subscription.subscriptionId === subscriptionId);
    if (subscription) {
      return subscription.session;
    }

    return undefined;
  }

  private static async _getSession(): Promise<AzureSession|undefined> {
    AzureUtility._subscriptionId = await AzureUtility._getSubscription();

    if (!AzureUtility._subscriptionId) {
      return undefined;
    }

    return AzureUtility._getSessionBySubscriptionId(
      AzureUtility._subscriptionId);
  }

  private static async _getResourceClient(): Promise<ResourceManagementClient | undefined> {
    AzureUtility._subscriptionId = await AzureUtility._getSubscription();

    if (!AzureUtility._subscriptionId) {
      return undefined;
    }

    const session = await AzureUtility._getSession();
    if (session) {
      const credential = session.credentials;
      const client = new ResourceManagementClient(
        credential, AzureUtility._subscriptionId,
        session.environment.resourceManagerEndpointUrl);
      return client;
    }
    return undefined;
  }

  private static _getSubscriptionClientBySubscriptionId(substriptionId: string): ResourceManagementClient | undefined {
    const session = AzureUtility._getSessionBySubscriptionId(substriptionId);
    if (session) {
      const credential = session.credentials;
      const client = new ResourceManagementClient(
        credential, substriptionId,
        session.environment.resourceManagerEndpointUrl);
      return client;
    }
    return undefined;
  }

  private static async _getSubscriptionClient(): Promise<SubscriptionClient | undefined> {
    const session = await AzureUtility._getSession();
    if (session) {
      const credential = session.credentials;
      const client = new SubscriptionClient(
        credential, session.environment.resourceManagerEndpointUrl);
      return client;
    }
    return undefined;
  }

  private static async _getLocations(): Promise<SubscriptionModels.LocationListResult | undefined> {
    AzureUtility._subscriptionId = await AzureUtility._getSubscription();

    if (!AzureUtility._subscriptionId) {
      return undefined;
    }

    const client = await AzureUtility._getSubscriptionClient();
    if (!client) {
      return undefined;
    }

    const locations =
        await client.subscriptions.listLocations(AzureUtility._subscriptionId);
    return locations;
  }

  private static async _createResouceGroup(): Promise<string | undefined> {
    const client = await AzureUtility._getResourceClient();
    if (!client) {
      return undefined;
    }

    const resourceGroupName = await vscode.window.showInputBox({
      prompt: 'Input resouce group name',
      ignoreFocusOut: true,
      validateInput: async (name: string) => {
        if (!/^[a-z0-9_\-.]*[a-z0-9_-]+$/.test(name)) {
          return 'Resource group names only allow alphanumeric characters, periods, underscores, hyphens and parenthesis and cannot end in a period.';
        }

        const exist = await client.resourceGroups.checkExistence(name);
        if (exist) {
          return 'Azure name is unavailable';
        }

        return '';
      }
    });

    if (!resourceGroupName) {
      return undefined;
    }

    const locations = await AzureUtility._getLocations();
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
      { placeHolder: 'Select Resource Group Location', ignoreFocusOut: true });
    if (!resourceGroupLocation || !resourceGroupLocation.description) {
      return undefined;
    }

    const resourceGroup = await client.resourceGroups.createOrUpdate(
      resourceGroupName, { location: resourceGroupLocation.description });

    return resourceGroup.name;
  }

  private static _commonParameterCheck(_value: string, parameter: ARMParameterTemplateValue): string {
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
      return `The value does't meet requirement: minLength ${
        parameter.minLength}.`;
    }

    if (typeof value === 'string' && parameter.maxLength !== undefined &&
        parameter.maxLength < value.length) {
      return `The value does't meet requirement: maxLength ${
        parameter.maxLength}.`;
    }

    if (typeof value === 'number' && parameter.minValue !== undefined &&
        parameter.minValue > value) {
      return `The value does't meet requirement: minValue ${
        parameter.minValue}.`;
    }

    if (typeof value === 'number' && parameter.maxValue !== undefined &&
        parameter.maxValue < value) {
      return `The value does't meet requirement: maxValue ${
        parameter.maxValue}.`;
    }

    if (typeof value === 'number' && isNaN(value)) {
      return `The value is not a valid number.`;
    }

    return '';
  }

  private static _getKeyDisplayName(key: string): string {
    key = key.replace(/^\$*/, '');
    const keyDisplayName = key.replace(/([A-Z][^A-Z])/g, ' $1')
      .replace(/([a-z])([A-Z])/g, '$1 $2');
    return keyDisplayName.substr(0, 1).toUpperCase() + keyDisplayName.substr(1);
  }

  private static async _getARMParameters(parameterTemplate: ARMParameterTemplate, parameters?: ARMParameters): Promise<ARMParameters|undefined> {
    parameters = parameters || {} as ARMParameters;
    for (const key of Object.keys(parameterTemplate)) {
      if (Object.prototype.hasOwnProperty.call(parameters, key)) {
        continue;
      }

      const keyDisplayName = AzureUtility._getKeyDisplayName(key);
      const parameter = parameterTemplate[key];
      let value: string|number|boolean|null = null;
      let inputValue = '';

      if (parameter.allowedValues) {
        const values: vscode.QuickPickItem[] = [];
        for (const value of parameter.allowedValues) {
          if (value !== null) {
            values.push({ label: value.toString(), description: '' });
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
        if (!(vscode.workspace.workspaceFolders &&
              vscode.workspace.workspaceFolders.length > 0)) {
          inputValue = '';
        } else {
          const _key = key.substr(2);
          const filePath = path.join(
            vscode.workspace.workspaceFolders[0].uri.fsPath, '..', _key);
          AzureUtility._context.asAbsolutePath(_key);
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
          inputValue = AzureUtility._subscriptionId || '';
          break;
        default:{
          const _value = ConfigHandler.get<string>(_key);
          if (!_value) {
            inputValue = '';
          } else {
            inputValue = _value;
          }
        }
        }
      } else {
        const _value = await vscode.window.showInputBox({
          prompt: `Input value for ${keyDisplayName}`,
          ignoreFocusOut: true,
          value: parameter.defaultValue ? parameter.defaultValue.toString() :
            '',
          validateInput: async (value: string) => {
            return AzureUtility._commonParameterCheck(value, parameter);
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

      parameters[key] = { value };
    }

    return parameters;
  }

  private static async _getSubscription(): Promise<string | undefined> {
    if (AzureUtility._subscriptionId) {
      return AzureUtility._subscriptionId;
    }

    const subscription = await vscode.window.showQuickPick(
      AzureUtility._getSubscriptionList(),
      { placeHolder: 'Select Subscription', ignoreFocusOut: true });
    if (!subscription || !subscription.description) {
      return undefined;
    }

    const telemetryWorker = TelemetryWorker.getInstance(AzureUtility._context);
    const telemetryContext = telemetryWorker.createContext();
    telemetryContext.properties.subscription = subscription.description;

    try {
      telemetryWorker.sendEvent(
        EventNames.selectSubscription, telemetryContext);
    } catch {
      // If sending telemetry failed, skip the error to avoid blocking user.
    }
    return subscription.description;
  }

  private static async _getResourceGroupItems(): Promise<vscode.QuickPickItem[]> {
    const client = await AzureUtility._getResourceClient();

    if (!client) {
      return [];
    }

    const resourceGrouplist: vscode.QuickPickItem[] =
        [{ label: '$(plus) Create Resource Group', description: '', detail: '' }];

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

  static async getResourceGroup(): Promise<string | undefined> {
    const client = await AzureUtility._getResourceClient();

    if (!client) {
      AzureUtility._resourceGroup = undefined;
      return undefined;
    }

    const choice = await vscode.window.showQuickPick(
      AzureUtility._getResourceGroupItems(),
      { placeHolder: 'Select Resource Group', ignoreFocusOut: true });

    if (!choice) {
      AzureUtility._resourceGroup = undefined;
      return undefined;
    }

    if (choice.description === '') {
      const resourceGroup = await AzureUtility._createResouceGroup();
      AzureUtility._resourceGroup = resourceGroup;
      return resourceGroup;
    } else {
      AzureUtility._resourceGroup = choice.label;
      return choice.label;
    }
  }

  static async deployARMTemplate(template: ARMTemplate, parameters?: ARMParameters): Promise<ResourceModels.DeploymentExtended | undefined> {
    const client = await AzureUtility._getResourceClient();
    if (!client) {
      return undefined;
    }

    if (!AzureUtility._resourceGroup) {
      return undefined;
    }

    parameters =
        await AzureUtility._getARMParameters(template.parameters, parameters);
    if (!parameters) {
      return undefined;
    }

    let deployPending: NodeJS.Timer|null = null;
    if (AzureUtility._channel) {
      deployPending = setInterval(() => {
        if (AzureUtility._channel) {
          channelShowAndAppendLine(AzureUtility._channel, '.');
        }
      }, 1000);
    }

    const mode = 'Incremental';
    const deploymentParameters:
        ResourceModels.Deployment = { properties: { parameters, template, mode } };

    try {
      const deployment = await client.deployments.createOrUpdate(
        AzureUtility._resourceGroup,
        `IoTWorkbecnhDeploy${new Date().getTime()}`, deploymentParameters);

      if (AzureUtility._channel && deployPending) {
        clearInterval(deployPending);
        channelShowAndAppendLine(AzureUtility._channel, '.');
        channelPrintJsonObject(AzureUtility._channel, deployment);
      }
      return deployment;
    } catch (error) {
      if (AzureUtility._channel && deployPending) {
        clearInterval(deployPending);
        channelShowAndAppendLine(AzureUtility._channel, '.');
        channelShowAndAppendLine(AzureUtility._channel, error);
      }
      return undefined;
    }
  }

  static get subscriptionId(): string|undefined {
    return AzureUtility._subscriptionId;
  }

  static get resourceGroup(): string|undefined {
    return AzureUtility._resourceGroup;
  }

  static getClient(): ResourceManagementClient |undefined {
    if (!AzureUtility._subscriptionId) {
      return undefined;
    }

    const client = AzureUtility._getSubscriptionClientBySubscriptionId(
      AzureUtility._subscriptionId);
    if (!client) {
      return undefined;
    }

    return client;
  }

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  static async request(method: HttpMethods, resource: string, body: any = null): Promise<unknown> {
    const session = await AzureUtility._getSession();
    if (!session) {
      return undefined;
    }

    const credential = session.credentials;
    const httpRequest = new WebResource();
    httpRequest.method = method;
    httpRequest.url = 'https://management.azure.com' + resource;
    httpRequest.body = body;
    if (method === 'GET' || method === 'DELETE') {
      delete httpRequest.body;
    }

    const httpRequestOption: (rq.UrlOptions&request.RequestPromiseOptions) =
        httpRequest;
    httpRequestOption.simple = false;
    httpRequestOption.json = true;

    return new Promise((resolve) => {
      credential.signRequest(httpRequest, async err => {
        if (!err) {
          const res = await request(httpRequestOption);
          return resolve(res);
        } else {
          throw err;
        }
      });
    });
  }

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  static async postRequest(resource: string, body: any = null): Promise<unknown> {
    return AzureUtility.request('POST', resource, body);
  }

  static async getRequest(resource: string): Promise<unknown> {
    return AzureUtility.request('GET', resource);
  }
}
