// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as fs from "fs-plus";
import * as path from "path";
import * as vscode from "vscode";

import * as utils from "../utils";
import WebSiteManagementClient = require("azure-arm-website");
import { Component, ComponentType } from "./Interfaces/Component";
import { Provisionable } from "./Interfaces/Provisionable";
import { Deployable } from "./Interfaces/Deployable";

import { ConfigHandler } from "../configHandler";
import {
  ConfigKey,
  AzureFunctionsLanguage,
  AzureComponentsStorage,
  DependentExtensions,
  ScaffoldType
} from "../constants";

import { ServiceClientCredentials } from "ms-rest";
import { AzureAccount, AzureResourceFilter } from "../azure-account.api";
import { StringDictionary } from "azure-arm-website/lib/models";
import { getExtension } from "./Apis";
import { ExtensionName } from "./Interfaces/Api";
import { Guid } from "guid-typescript";
import {
  AzureComponentConfig,
  AzureConfigs,
  ComponentInfo,
  DependencyConfig,
  Dependency,
  AzureConfigFileHandler
} from "./AzureComponentConfig";
import { FileUtility } from "../FileUtility";
import { VscodeCommands, AzureFunctionsCommands } from "../common/Commands";
import {
  DependentExtensionNotFoundError,
  AugumentEmptyOrNullError,
  ResourceNotFoundError
} from "../common/Error/Error";
import { OperationCanceledError } from "../common/Error/OperationCanceledError";
import { OperationFailedError } from "../common/Error/OperationFailedError";
import { ConfigNotFoundError } from "../common/Error/ConfigNotFoundError";

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

  private componentId: string;
  get id(): string {
    return this.componentId;
  }

  private async getCredentialFromSubscriptionId(subscriptionId: string): Promise<ServiceClientCredentials | undefined> {
    if (!this.azureAccountExtension) {
      throw new DependentExtensionNotFoundError(ExtensionName.AzureAccount);
    }

    if (!subscriptionId) {
      throw new AugumentEmptyOrNullError("subscription ID");
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
    if (!vscode.extensions.getExtension(DependentExtensions.azureFunctions)) {
      const choice = await vscode.window.showInformationMessage(
        "Azure Functions extension is required for the current project. Do you want to install it from marketplace?",
        "Yes",
        "No"
      );
      if (choice === "Yes") {
        vscode.commands.executeCommand(
          VscodeCommands.VscodeOpen,
          vscode.Uri.parse("vscode:extension/" + DependentExtensions.azureFunctions)
        );
      }
      return false;
    }

    return true;
  }

  async checkPrerequisites(): Promise<boolean> {
    const isFunctionsExtensionAvailable = await AzureFunctions.isAvailable();
    if (!isFunctionsExtensionAvailable) {
      return false;
    }
    return true;
  }

  async load(): Promise<void> {
    const azureConfigFilePath = path.join(
      this.azureFunctionsPath,
      "..",
      AzureComponentsStorage.folderName,
      AzureComponentsStorage.fileName
    );

    if (!fs.existsSync(azureConfigFilePath)) {
      throw new ResourceNotFoundError("load Azure Functions", `azure configuratio file ${azureConfigFilePath}`);
    }

    const azureConfigs: AzureConfigs = JSON.parse(fs.readFileSync(azureConfigFilePath, "utf8"));
    const azureFunctionsConfig = azureConfigs.componentConfigs.find(config => config.folder === this.functionFolder);
    if (azureFunctionsConfig) {
      this.componentId = azureFunctionsConfig.id;
      this.dependencies = azureFunctionsConfig.dependencies;
      if (azureFunctionsConfig.componentInfo) {
        this.functionLanguage = azureFunctionsConfig.componentInfo.values.functionLanguage;
      }

      // Load other information from config file.
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
      throw new OperationFailedError("create function application", "Please check the error log in output window.");
    }
    await ConfigHandler.update(ConfigKey.functionAppId, functionAppId);
    const eventHubConnectionString = ConfigHandler.get<string>(ConfigKey.eventHubConnectionString);
    const eventHubConnectionPath = ConfigHandler.get<string>(ConfigKey.eventHubConnectionPath);
    const iotHubConnectionString = ConfigHandler.get<string>(ConfigKey.iotHubConnectionString);

    if (!eventHubConnectionString) {
      throw new ConfigNotFoundError(ConfigKey.eventHubConnectionString);
    }
    if (!eventHubConnectionPath) {
      throw new ConfigNotFoundError(ConfigKey.eventHubConnectionPath);
    }

    const credential = await this.getCredentialFromSubscriptionId(subscriptionId);
    if (!credential) {
      throw new OperationFailedError("get credential for the subscription");
    }

    const resourceGroupMatches = functionAppId.match(/\/resourceGroups\/([^\/]*)/);
    if (!resourceGroupMatches || resourceGroupMatches.length < 2) {
      throw new OperationFailedError(`parse resource group from function app ID ${functionAppId}`);
    }
    resourceGroup = resourceGroupMatches[1];

    const siteNameMatches = functionAppId.match(/\/sites\/([^\/]*)/);
    if (!siteNameMatches || siteNameMatches.length < 2) {
      throw new OperationFailedError(`parse function app name from function app ID ${functionAppId}`);
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
      const functionAppId = ConfigHandler.get(ConfigKey.functionAppId);
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
    const azureConfigFilePath = path.join(
      this.azureFunctionsPath,
      "..",
      AzureComponentsStorage.folderName,
      AzureComponentsStorage.fileName
    );

    let azureConfigs: AzureConfigs = { componentConfigs: [] };
    azureConfigs = await AzureConfigFileHandler.loadAzureConfigs(type, azureConfigFilePath);

    const azureFunctionsConfig = azureConfigs.componentConfigs.find(config => config.id === this.id);
    if (azureFunctionsConfig) {
      // TODO: update the existing setting for the provision result
    } else {
      const newAzureFunctionsConfig: AzureComponentConfig = {
        id: this.id,
        folder: this.functionFolder,
        name: "",
        dependencies: this.dependencies,
        type: this.componentType,
        componentInfo
      };
      azureConfigs.componentConfigs.push(newAzureFunctionsConfig);
      await FileUtility.writeJsonFile(type, azureConfigFilePath, azureConfigs);
      utils.channelPrintJsonObject(this.channel, azureConfigs);
    }
  }
}
