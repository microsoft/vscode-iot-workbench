// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {ConfigKey, DependentExtensions, DevelopEnvironment, EventNames, FileNames, ScaffoldType} from '../constants';
import {FileUtility} from '../FileUtility';
import {TelemetryContext, TelemetryProperties, TelemetryWorker} from '../telemetry';
import {channelShowAndAppendLine} from '../utils';

import {Dependency} from './AzureComponentConfig';
import {Component} from './Interfaces/Component';
import {ProjectHostType} from './Interfaces/ProjectHostType';
import {ProjectTemplateType, TemplateFileInfo} from './Interfaces/ProjectTemplate';
import {IoTWorkbenchProjectBase} from './IoTWorkbenchProjectBase';
import {RemoteExtension} from './RemoteExtension';


const impor = require('impor')(__dirname);
const azureComponentConfigModule =
    impor('./AzureComponentConfig') as typeof import('./AzureComponentConfig');
const azureFunctionsModule =
    impor('./AzureFunctions') as typeof import('./AzureFunctions');
const cosmosDBModule = impor('./CosmosDB') as typeof import('./CosmosDB');
const ioTHubModule = impor('./IoTHub') as typeof import('./IoTHub');
const ioTHubDeviceModule =
    impor('./IoTHubDevice') as typeof import('./IoTHubDevice');
const raspberryPiDeviceModule =
    impor('./RaspberryPiDevice') as typeof import('./RaspberryPiDevice');
const streamAnalyticsJobModule =
    impor('./StreamAnalyticsJob') as typeof import('./StreamAnalyticsJob');
const telemetryModule = impor('../telemetry') as typeof import('../telemetry');

const constants = {
  asaFolderName: 'StreamAnalytics',
  functionDefaultFolderName: 'Functions',
  workspaceConfigExtension: '.code-workspace'
};
export class IoTContainerizedProject extends IoTWorkbenchProjectBase {
  constructor(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    super(context, channel, telemetryContext);
  }

  async load(initLoad = false): Promise<boolean> {
    const loadTimeScaffoldType = ScaffoldType.Workspace;
    if (!vscode.workspace.workspaceFolders) {
      return false;
    }

    this.projectRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const projectHostType: ProjectHostType =
        IoTWorkbenchProjectBase.GetProjectType(this.projectRootPath);
    if (projectHostType !== ProjectHostType.Container) {
      return false;
    }

    const iotworkbenchprojectFile =
        path.join(this.projectRootPath, FileNames.iotworkbenchprojectFileName);
    if (!await FileUtility.fileExists(
            loadTimeScaffoldType, iotworkbenchprojectFile)) {
      return false;
    }
    const projectConfigContent =
        await FileUtility.readFile(
            loadTimeScaffoldType, iotworkbenchprojectFile, 'utf8') as string;
    const projectConfigJson = JSON.parse(projectConfigContent);

    // only send telemetry when the IoT project is load when VS Code opens
    if (initLoad) {
      const properties: TelemetryProperties = {
        result: 'Succeeded',
        error: '',
        errorMessage: ''
      };
      properties.developEnvironment =
          RemoteExtension.isRemote(this.extensionContext) ?
          DevelopEnvironment.CONTAINER :
          DevelopEnvironment.LOCAL_ENV;
      properties.projectHostType = ProjectHostType[projectHostType];
      const telemetryContext:
          TelemetryContext = {properties, measurements: {duration: 0}};

      try {
        TelemetryWorker.sendEvent(
            EventNames.projectLoadEvent, telemetryContext);
      } catch {
        // If sending telemetry failed, skip the error to avoid blocking user.
      }
    }

    const azureConfigFileHandler =
        new azureComponentConfigModule.AzureConfigFileHandler(
            this.projectRootPath);
    azureConfigFileHandler.createIfNotExists(loadTimeScaffoldType);

    if (this.projectRootPath !== undefined) {
      const boardId = projectConfigJson[`${ConfigKey.boardId}`];
      if (!boardId) {
        return false;
      }
      let device = null;
      const projectType =
          projectConfigJson[`${ConfigKey.projectType}`] as ProjectTemplateType;
      if (!projectType) {
        return false;
      }
      if (boardId === raspberryPiDeviceModule.RaspberryPiDevice.boardId) {
        device = new raspberryPiDeviceModule.RaspberryPiDevice(
            this.extensionContext, this.projectRootPath, this.channel,
            projectType, this.telemetryContext);
      }
      if (device) {
        this.componentList.push(device);
        await device.load();
      }
    }

    const componentConfigs =
        await azureConfigFileHandler.getSortedComponents(loadTimeScaffoldType);
    if (!componentConfigs || componentConfigs.length === 0) {
      // Support backward compact
      const iotHub =
          new ioTHubModule.IoTHub(this.projectRootPath, this.channel);
      await iotHub.updateConfigSettings(loadTimeScaffoldType);
      await iotHub.load();
      this.componentList.push(iotHub);
      const device = new ioTHubDeviceModule.IoTHubDevice(this.channel);
      this.componentList.push(device);

      this.componentList.forEach(item => {
        item.checkPrerequisites();
      });

      return true;
    }


    const components: {[key: string]: Component} = {};

    for (const componentConfig of componentConfigs) {
      switch (componentConfig.type) {
        case 'IoTHub': {
          const iotHub =
              new ioTHubModule.IoTHub(this.projectRootPath, this.channel);
          await iotHub.load();
          components[iotHub.id] = iotHub;
          this.componentList.push(iotHub);
          const device = new ioTHubDeviceModule.IoTHubDevice(this.channel);
          this.componentList.push(device);

          break;
        }
        case 'AzureFunctions': {
          const functionPath = projectConfigJson[`${ConfigKey.functionPath}`];
          if (!functionPath) {
            return false;
          }
          const functionLocation = path.join(
              vscode.workspace.workspaceFolders[0].uri.fsPath, '..',
              functionPath);
          if (functionLocation) {
            const functionApp = new azureFunctionsModule.AzureFunctions(
                functionLocation, functionPath, this.channel);
            await functionApp.load();
            components[functionApp.id] = functionApp;
            this.componentList.push(functionApp);
          }
          break;
        }
        case 'StreamAnalyticsJob': {
          const dependencies: Dependency[] = [];
          for (const dependent of componentConfig.dependencies) {
            const component = components[dependent.id];
            if (!component) {
              throw new Error(`Cannot find component with id ${dependent}.`);
            }
            dependencies.push({component, type: dependent.type});
          }
          const queryPath = path.join(
              vscode.workspace.workspaceFolders[0].uri.fsPath, '..',
              constants.asaFolderName, 'query.asaql');
          const asa = new streamAnalyticsJobModule.StreamAnalyticsJob(
              queryPath, this.extensionContext, this.projectRootPath,
              this.channel, dependencies);
          await asa.load();
          components[asa.id] = asa;
          this.componentList.push(asa);
          break;
        }
        case 'CosmosDB': {
          const dependencies: Dependency[] = [];
          for (const dependent of componentConfig.dependencies) {
            const component = components[dependent.id];
            if (!component) {
              throw new Error(`Cannot find component with id ${dependent}.`);
            }
            dependencies.push({component, type: dependent.type});
          }
          const cosmosDB = new cosmosDBModule.CosmosDB(
              this.extensionContext, this.projectRootPath, this.channel,
              dependencies);
          await cosmosDB.load();
          components[cosmosDB.id] = cosmosDB;
          this.componentList.push(cosmosDB);
          break;
        }
        default: {
          throw new Error(
              `Component not supported with type of ${componentConfig.type}.`);
        }
      }
    }

    this.componentList.forEach(item => {
      item.checkPrerequisites();
    });

    return true;
  }

  async create(
      rootFolderPath: string, templateFilesInfo: TemplateFileInfo[],
      projectType: ProjectTemplateType, boardId: string,
      openInNewWindow: boolean): Promise<boolean> {
    const result = await this.checkPrerequisites();
    if (!result) {
      return false;
    }
    const createTimeScaffoldType = ScaffoldType.Local;
    if (rootFolderPath !== undefined) {
      await FileUtility.mkdirRecursively(
          createTimeScaffoldType, rootFolderPath);
    } else {
      throw new Error(
          'Unable to find the root path, please open the folder and initialize project again.');
    }

    this.projectRootPath = rootFolderPath;

    // initialize the storage for azure component settings
    const azureConfigFileHandler =
        new azureComponentConfigModule.AzureConfigFileHandler(
            this.projectRootPath);
    azureConfigFileHandler.createIfNotExists(createTimeScaffoldType);

    const projectConfig: {[key: string]: string} = {};

    let device: Component;
    if (boardId === raspberryPiDeviceModule.RaspberryPiDevice.boardId) {
      device = new raspberryPiDeviceModule.RaspberryPiDevice(
          this.extensionContext, this.projectRootPath, this.channel,
          projectType, this.telemetryContext, templateFilesInfo);
    } else {
      throw new Error('The specified board is not supported.');
    }

    // const isPrerequisitesAchieved = await device.checkPrerequisites();
    // if (!isPrerequisitesAchieved) {
    //   return false;
    // }

    projectConfig[`${ConfigKey.boardId}`] = boardId;
    this.componentList.push(device);

    projectConfig[`${ConfigKey.projectType}`] = projectType;
    switch (projectType) {
      case ProjectTemplateType.Basic:
        // Save data to configFile
        break;
      case ProjectTemplateType.IotHub: {
        const iothub =
            new ioTHubModule.IoTHub(this.projectRootPath, this.channel);
        // const isPrerequisitesAchieved = await iothub.checkPrerequisites();
        // if (!isPrerequisitesAchieved) {
        //   return false;
        // }
        this.componentList.push(iothub);
        break;
      }
      case ProjectTemplateType.AzureFunctions: {
        const iothub =
            new ioTHubModule.IoTHub(this.projectRootPath, this.channel);
        // const isIotHubPrerequisitesAchieved = await
        // iothub.checkPrerequisites(); if (!isIotHubPrerequisitesAchieved) {
        //   return false;
        // }

        const functionDir = path.join(
            this.projectRootPath, constants.functionDefaultFolderName);

        if (!await FileUtility.directoryExists(
                createTimeScaffoldType, functionDir)) {
          await FileUtility.mkdirRecursively(
              createTimeScaffoldType, functionDir);
        }

        const azureFunctions = new azureFunctionsModule.AzureFunctions(
            functionDir, constants.functionDefaultFolderName, this.channel,
            null, [{
              component: iothub,
              type: azureComponentConfigModule.DependencyType.Input
            }] /*Dependencies*/);
        const isFunctionsPrerequisitesAchieved =
            await azureFunctions.checkPrerequisites();
        if (!isFunctionsPrerequisitesAchieved) {
          const message =
              `Azure Functions extension is required to create an Azure Functions type IoT Project. Please install it from marketplace first.`;
          vscode.window.showWarningMessage(message);
          return false;
        }

        projectConfig[`${ConfigKey.functionPath}`] =
            constants.functionDefaultFolderName;

        this.componentList.push(iothub);
        this.componentList.push(azureFunctions);
        break;
      }
      case ProjectTemplateType.StreamAnalytics: {
        const iothub =
            new ioTHubModule.IoTHub(this.projectRootPath, this.channel);
        // const isIotHubPrerequisitesAchieved = await
        // iothub.checkPrerequisites(); if (!isIotHubPrerequisitesAchieved) {
        //   return false;
        // }

        const cosmosDB = new cosmosDBModule.CosmosDB(
            this.extensionContext, this.projectRootPath, this.channel);
        // const isCosmosDBPrerequisitesAchieved =
        //     await cosmosDB.checkPrerequisites();
        // if (!isCosmosDBPrerequisitesAchieved) {
        //   return false;
        // }

        const asaDir = path.join(this.projectRootPath, constants.asaFolderName);

        if (!await FileUtility.directoryExists(
                createTimeScaffoldType, asaDir)) {
          await FileUtility.mkdirRecursively(createTimeScaffoldType, asaDir);
        }

        const asaFilePath = this.extensionContext.asAbsolutePath(
            path.join(FileNames.resourcesFolderName, 'asaql', 'query.asaql'));
        const queryPath = path.join(asaDir, 'query.asaql');
        const asaQueryContent =
            fs.readFileSync(asaFilePath, 'utf8')
                .replace(/\[input\]/, `"iothub-${iothub.id}"`)
                .replace(/\[output\]/, `"cosmosdb-${cosmosDB.id}"`);
        await FileUtility.writeFile(
            createTimeScaffoldType, queryPath, asaQueryContent);

        const asa = new streamAnalyticsJobModule.StreamAnalyticsJob(
            queryPath, this.extensionContext, this.projectRootPath,
            this.channel, [
              {
                component: iothub,
                type: azureComponentConfigModule.DependencyType.Input
              },
              {
                component: cosmosDB,
                type: azureComponentConfigModule.DependencyType.Other
              }
            ]);
        // const isAsaPrerequisitesAchieved = await asa.checkPrerequisites();
        // if (!isAsaPrerequisitesAchieved) {
        //   return false;
        // }

        projectConfig[`${ConfigKey.asaPath}`] = constants.asaFolderName;

        this.componentList.push(iothub);
        this.componentList.push(cosmosDB);
        this.componentList.push(asa);
        break;
      }
      default:
        break;
    }

    // Component level creation
    // we cannot use forEach here:
    // https://stackoverflow.com/questions/37576685/using-async-await-with-a-foreach-loop
    // this.componentList.forEach(async (element: Component) => {
    //   await element.create();
    // });

    try {
      for (let i = 0; i < this.componentList.length; i++) {
        const res = await this.componentList[i].create();
        if (res === false) {
          // TODO: Remove this function and implement with sdk in FileUtility
          fs.removeSync(this.projectRootPath);
          vscode.window.showWarningMessage('Project initialize cancelled.');
          return false;
        }
      }
    } catch (error) {
      throw error;
    }

    const iotworkbenchprojectFile =
        path.join(this.projectRootPath, FileNames.iotworkbenchprojectFileName);
    if (await FileUtility.fileExists(
            createTimeScaffoldType, iotworkbenchprojectFile)) {
      const indentationSpace = 4;
      FileUtility.writeFile(
          createTimeScaffoldType, iotworkbenchprojectFile,
          JSON.stringify(projectConfig, null, indentationSpace));
    } else {
      throw new Error(
          `Internal Error. Could not find iot workbench project file.`);
    }

    if (!openInNewWindow) {
      // Need to add telemetry here otherwise, after restart VSCode, no
      // telemetry data will be sent.
      try {
        telemetryModule.TelemetryWorker.sendEvent(
            EventNames.createNewProjectEvent, this.telemetryContext);
      } catch {
        // If sending telemetry failed, skip the error to avoid blocking user.
      }
    }

    try {
      setTimeout(
          // TODO: better implement this through VS Remote API.
          // Currently implemented in helper extension iotcube.
          () => vscode.commands.executeCommand(
              'iotcube.openInContainer', this.projectRootPath),
          500);  // TODO: Remove this magic number

      return true;
    } catch (error) {
      throw error;
    }
  }

  async checkPrerequisites(): Promise<boolean> {
    return await RemoteExtension.checkRemoteExtension(this.channel);
  }
}