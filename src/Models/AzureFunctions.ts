// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as path from "path";
import * as vscode from "vscode";

import * as utils from "../utils";
import WebSiteManagementClient = require("azure-arm-website");
import { Component, ComponentType } from "./Interfaces/Component";
import { Provisionable } from "./Interfaces/Provisionable";
import { Deployable } from "./Interfaces/Deployable";

import { AzureFunctionsLanguage, ScaffoldType } from "../constants";

import { ServiceClientCredentials } from "ms-rest";
import { AzureAccount, AzureResourceFilter } from "../azure-account.api";
import { StringDictionary } from "azure-arm-website/lib/models";
import { getExtension, checkExtensionAvailable } from "./Apis";
import { ExtensionName } from "./Interfaces/Api";
import { Guid } from "guid-typescript";
import {
  AzureComponentConfig,
  ComponentInfo,
  DependencyConfig,
  Dependency,
  AzureConfigFileHandler
} from "./AzureComponentConfig";
import { FileUtility } from "../FileUtility";
import { AzureFunctionsCommands } from "../common/Commands";
import { OperationCanceledError } from "../common/Error/OperationCanceledError";
import { OperationFailedError } from "../common/Error/OperationFailedErrors/OperationFailedError";
import { DependentExtensionNotFoundError } from "../common/Error/OperationFailedErrors/DependentExtensionNotFoundError";
import { ArgumentEmptyOrNullError } from "../common/Error/OperationFailedErrors/ArgumentEmptyOrNullError";
import { AzureConfigNotFoundError } from "../common/Error/SystemErrors/AzureConfigNotFoundErrors";

const impor = require("impor")(__dirname);
const azureUtilityModule = impor("./AzureUtility") as typeof import("./AzureUtility");

export class AzureFunctions implements Component, Provisionable, Deployable {
  dependencies: DependencyConfig[] = [];
  private componentType: ComponentType;
  private channel: vscode.OutputChannel;
  private azureFunctionsPath: string;
  private azureAccountExtension: AzureAccount | undefined = getExtension(ExtensionName.AzureAccount);
  private functionLanguage: string | null;
  private functionFolder: string;
  private projectRootPath: string;
  private azureConfigFileHandler: AzureConfigFileHandler;
  private componentId: string;
  get id(): string {
    return this.componentId;
  }

  private async getCredentialFromSubscriptionId(subscriptionId: string): Promise<ServiceClientCredentials | undefined> {
    if (!this.azureAccountExtension) {
      throw new DependentExtensionNotFoundError("get credential from subscription id", ExtensionName.AzureAccount);
    }

    if (!subscriptionId) {
      throw new ArgumentEmptyOrNullError("get credential from subscription id", "subscription ID");
    }

    const subscriptions: AzureResourceFilter[] = this.azureAccountExtension.filters;
    for (let i = 0; i < subscriptions.length; i++) {
      const subscription: AzureResourceFilter = subscriptions[i];
      if (subscription.subscription.subscriptionId === subscriptionId) {
        return subscription.session.credentials;
      }
    }

    return undefined;
  }

  constructor(
    projectRoot: string,
    azureFunctionsPath: string,
    functionFolder: string,
    channel: vscode.OutputChannel,
    language: string | null = null,
    dependencyComponents: Dependency[] | null = null
  ) {
    this.componentType = ComponentType.AzureFunctions;
    this.channel = channel;
    this.azureFunctionsPath = azureFunctionsPath;
    this.functionLanguage = language;
    this.functionFolder = functionFolder;
    this.componentId = Guid.create().toString();
    this.projectRootPath = projectRoot;
    this.azureConfigFileHandler = new AzureConfigFileHandler(this.projectRootPath);
    if (dependencyComponents && dependencyComponents.length > 0) {
      dependencyComponents.forEach(dependency =>
        this.dependencies.push({
          id: dependency.component.id.toString(),
          type: dependency.type
        })
      );
    }
  }

  name = "Azure Functions";

  getComponentType(): ComponentType {
    return this.componentType;
  }

  static async isAvailable(): Promise<boolean> {
    return await checkExtensionAvailable(ExtensionName.AzureFunctions);
  }

  async checkPrerequisites(operation: string): Promise<void> {
    const isFunctionsExtensionAvailable = await AzureFunctions.isAvailable();
    if (!isFunctionsExtensionAvailable) {
      throw new DependentExtensionNotFoundError(operation, ExtensionName.AzureFunctions);
    }
  }

  async load(): Promise<void> {
    const componentConfig = await this.azureConfigFileHandler.getComponentByFolder(
      ScaffoldType.Workspace,
      this.functionFolder
    );
    if (componentConfig) {
      this.componentId = componentConfig.id;
      this.dependencies = componentConfig.dependencies;
      if (componentConfig.componentInfo) {
        this.functionLanguage = componentConfig.componentInfo.values.functionLanguage;
      }
    }
  }

  async create(): Promise<void> {
    const scaffoldType = ScaffoldType.Local;
    console.log(this.azureFunctionsPath);

    if (!(await FileUtility.directoryExists(scaffoldType, this.azureFunctionsPath))) {
      await FileUtility.mkdirRecursively(scaffoldType, this.azureFunctionsPath);
    }

    if (!this.functionLanguage) {
      const picks: vscode.QuickPickItem[] = [
        { label: AzureFunctionsLanguage.CSharpScript, description: "" },
        { label: AzureFunctionsLanguage.JavaScript, description: "" },
        { label: AzureFunctionsLanguage.CSharpLibrary, description: "" }
      ];

      const languageSelection = await vscode.window.showQuickPick(picks, {
        ignoreFocusOut: true,
        matchOnDescription: true,
        matchOnDetail: true,
        placeHolder: "Select a language for Azure Functions"
      });

      if (!languageSelection) {
        throw new OperationCanceledError(
          "Unable to get the language for Azure Functions. Creating project for Azure Functions cancelled."
        );
      }
      this.functionLanguage = languageSelection.label;
    }

    const templateName = utils.getScriptTemplateNameFromLanguage(this.functionLanguage);
    if (!templateName) {
      throw new OperationCanceledError(
        "Unable to get the template for Azure Functions.Creating project for Azure Functions cancelled."
      );
    }

    if (this.functionLanguage === AzureFunctionsLanguage.CSharpLibrary) {
      await vscode.commands.executeCommand(
        AzureFunctionsCommands.CreateNewProject,
        this.azureFunctionsPath,
        this.functionLanguage,
        "~2",
        false /* openFolder */,
        templateName,
        "IoTHubTrigger1",
        {
          connection: "eventHubConnectionString",
          path: "%eventHubConnectionPath%",
          consumerGroup: "$Default",
          namespace: "IoTWorkbench"
        }
      );
    } else {
      await vscode.commands.executeCommand(
        AzureFunctionsCommands.CreateNewProject,
        this.azureFunctionsPath,
        this.functionLanguage,
        "~1",
        false /* openFolder */,
        templateName,
        "IoTHubTrigger1",
        {
          connection: "eventHubConnectionString",
          path: "%eventHubConnectionPath%",
          consumerGroup: "$Default"
        }
      );
    }

    await this.updateConfigSettings(scaffoldType, {
      values: { functionLanguage: this.functionLanguage }
    });
  }

  async provision(): Promise<boolean> {
    const subscriptionId = azureUtilityModule.AzureUtility.subscriptionId;
    if (!subscriptionId) {
      return false;
    }

    let resourceGroup = azureUtilityModule.AzureUtility.resourceGroup;
    if (!resourceGroup) {
      return false;
    }

    const functionAppId: string | undefined = await vscode.commands.executeCommand<string>(
      AzureFunctionsCommands.CreateFunctionApp,
      subscriptionId,
      resourceGroup
    );
    if (!functionAppId) {
      throw new OperationFailedError("create function application", "Please check the error log in output window.", "");
    }

    const scaffoldType = ScaffoldType.Workspace;
    const iotHubId = this.dependencies[0].id;
    const componentConfig = await this.azureConfigFileHandler.getComponentById(scaffoldType, iotHubId);
    if (!componentConfig) {
      throw new AzureConfigNotFoundError(`component of config id ${iotHubId}`);
    }
    if (!componentConfig.componentInfo) {
      throw new AzureConfigNotFoundError(`componentInfo of config id ${iotHubId}`);
    }
    const iotHubConnectionString = componentConfig.componentInfo.values.iotHubConnectionString;
    if (!iotHubConnectionString) {
      throw new AzureConfigNotFoundError(`iothubConnectionString of config id ${iotHubId}`);
    }
    const eventHubConnectionString = componentConfig.componentInfo.values.eventHubConnectionString;
    const eventHubConnectionPath = componentConfig.componentInfo.values.eventHubConnectionPath;

    if (!eventHubConnectionString) {
      throw new AzureConfigNotFoundError(`eventHubConnectionString of config id ${iotHubId}`);
    }
    if (!eventHubConnectionPath) {
      throw new AzureConfigNotFoundError(`evenHubConnectionPath of config id ${iotHubId}`);
    }

    const credential = await this.getCredentialFromSubscriptionId(subscriptionId);
    if (!credential) {
      throw new OperationFailedError("get credential from subscription id", "", "");
    }

    const resourceGroupMatches = functionAppId.match(/\/resourceGroups\/([^\/]*)/);
    if (!resourceGroupMatches || resourceGroupMatches.length < 2) {
      throw new OperationFailedError(`parse resource group from function app ID ${functionAppId}`, "", "");
    }
    resourceGroup = resourceGroupMatches[1];

    const siteNameMatches = functionAppId.match(/\/sites\/([^\/]*)/);
    if (!siteNameMatches || siteNameMatches.length < 2) {
      throw new OperationFailedError(`parse function app name from function app ID ${functionAppId}`, "", "");
    }
    const siteName = siteNameMatches[1];

    const client = new WebSiteManagementClient(credential, subscriptionId);
    console.log(resourceGroup, siteName);
    const appSettings: StringDictionary = await client.webApps.listApplicationSettings(resourceGroup, siteName);
    console.log(appSettings);
    appSettings.properties = appSettings.properties || {};

    // for c# library, use the default setting of ~2.
    if (this.functionLanguage !== (AzureFunctionsLanguage.CSharpLibrary as string)) {
      appSettings.properties["FUNCTIONS_EXTENSION_VERSION"] = "~1";
    } else {
      appSettings.properties["FUNCTIONS_EXTENSION_VERSION"] = "~2";
    }
    appSettings.properties["eventHubConnectionString"] = eventHubConnectionString || "";
    appSettings.properties["eventHubConnectionPath"] = eventHubConnectionPath || "";
    appSettings.properties["iotHubConnectionString"] = iotHubConnectionString || "";
    // see detail:
    // https://github.com/Microsoft/vscode-iot-workbench/issues/436
    appSettings.properties["WEBSITE_RUN_FROM_PACKAGE"] = "0";

    await client.webApps.updateApplicationSettings(resourceGroup, siteName, appSettings);

    if (this.functionLanguage) {
      await this.updateConfigSettings(scaffoldType, {
        values: {
          functionLanguage: this.functionLanguage,
          functionAppId
        }
      });
    }

    return true;
  }

  async deploy(): Promise<boolean> {
    let deployPending: NodeJS.Timer | null = null;
    if (this.channel) {
      utils.channelShowAndAppendLine(this.channel, "Deploying Azure Functions App...");
      deployPending = setInterval(() => {
        this.channel.append(".");
      }, 1000);
    }

    try {
      const azureFunctionsPath = this.azureFunctionsPath;
      const componentConfig = await this.azureConfigFileHandler.getComponentById(ScaffoldType.Workspace, this.id);
      if (!componentConfig) {
        throw new AzureConfigNotFoundError(`component of config id ${this.id}`);
      }
      if (!componentConfig.componentInfo) {
        throw new AzureConfigNotFoundError(`componentInfo of config id ${this.id}`);
      }
      const functionAppId = componentConfig.componentInfo.values.functionAppId;
      if (this.functionLanguage !== (AzureFunctionsLanguage.CSharpLibrary as string)) {
        await vscode.commands.executeCommand(AzureFunctionsCommands.Deploy, azureFunctionsPath, functionAppId);
      } else {
        const subPath = path.join(azureFunctionsPath, "bin/Release/netcoreapp2.1/publish");
        await vscode.commands.executeCommand(AzureFunctionsCommands.Deploy, subPath, functionAppId);
      }
      console.log(azureFunctionsPath, functionAppId);

      return true;
    } finally {
      if (this.channel && deployPending) {
        clearInterval(deployPending);
        utils.channelShowAndAppendLine(this.channel, ".");
      }
    }
  }

  async updateConfigSettings(type: ScaffoldType, componentInfo?: ComponentInfo): Promise<void> {
    const componentIndex = await this.azureConfigFileHandler.getComponentIndexById(type, this.id);
    if (componentIndex > -1) {
      if (componentInfo) {
        await this.azureConfigFileHandler.updateComponent(type, componentIndex, componentInfo);
      }
    } else {
      const newAzureFunctionsConfig: AzureComponentConfig = {
        id: this.id,
        folder: this.functionFolder,
        name: "",
        dependencies: this.dependencies,
        type: this.componentType,
        componentInfo
      };
      await this.azureConfigFileHandler.appendComponent(type, newAzureFunctionsConfig);
    }
  }
}
