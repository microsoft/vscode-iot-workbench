// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, DevelopEnvironment, EventNames, FileNames, PlatformType, ScaffoldType} from '../constants';
import {FileUtility} from '../FileUtility';
import {ProjectEnvironmentConfiger} from '../ProjectEnvironmentConfiger';
import {TelemetryContext, TelemetryProperties, TelemetryWorker} from '../telemetry';
import {channelShowAndAppendLine, generateTemplateFile} from '../utils';

import {Dependency} from './AzureComponentConfig';
import {Component} from './Interfaces/Component';
import {ProjectHostType} from './Interfaces/ProjectHostType';
import {ProjectTemplateType, TemplateFileInfo} from './Interfaces/ProjectTemplate';
import {Workspace} from './Interfaces/Workspace';
import {IoTWorkbenchProjectBase} from './IoTWorkbenchProjectBase';
import {RemoteExtension} from './RemoteExtension';

const impor = require('impor')(__dirname);
const az3166DeviceModule =
    impor('./AZ3166Device') as typeof import('./AZ3166Device');
const azureComponentConfigModule =
    impor('./AzureComponentConfig') as typeof import('./AzureComponentConfig');
const azureFunctionsModule =
    impor('./AzureFunctions') as typeof import('./AzureFunctions');
const cosmosDBModule = impor('./CosmosDB') as typeof import('./CosmosDB');
const esp32DeviceModule =
    impor('./Esp32Device') as typeof import('./Esp32Device');
const ioTButtonDeviceModule =
    impor('./IoTButtonDevice') as typeof import('./IoTButtonDevice');
const ioTHubModule = impor('./IoTHub') as typeof import('./IoTHub');
const ioTHubDeviceModule =
    impor('./IoTHubDevice') as typeof import('./IoTHubDevice');
const streamAnalyticsJobModule =
    impor('./StreamAnalyticsJob') as typeof import('./StreamAnalyticsJob');
const telemetryModule = impor('../telemetry') as typeof import('../telemetry');

const constants = {
  deviceDefaultFolderName: 'Device',
  functionDefaultFolderName: 'Functions',
  asaFolderName: 'StreamAnalytics'
};


export class IoTWorkspaceProject extends IoTWorkbenchProjectBase {
  constructor(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    super(context, channel, telemetryContext);
    this.projectHostType = ProjectHostType.Workspace;
  }

  async load(initLoad = false): Promise<boolean> {
    const loadTimeScaffoldType = ScaffoldType.Workspace;

    if (!(vscode.workspace.workspaceFolders &&
          vscode.workspace.workspaceFolders.length > 0)) {
      return false;
    }

    const devicePath = ConfigHandler.get<string>(ConfigKey.devicePath);
    if (!devicePath) {
      return false;
    }

    this.projectRootPath =
        path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '..');

    const deviceLocation = path.join(this.projectRootPath, devicePath);

    // only send telemetry when the IoT project is load when VS Code opens
    if (initLoad) {
      const properties: TelemetryProperties = {
        result: 'Succeeded',
        error: '',
        errorMessage: ''
      };
      properties.developEnvironment =
          RemoteExtension.isRemote(this.extensionContext) ?
          DevelopEnvironment.Container :
          DevelopEnvironment.LocalEnv;
      properties.projectHostType = ProjectHostType[this.projectHostType];
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

    if (deviceLocation !== undefined) {
      const boardId = ConfigHandler.get<string>(ConfigKey.boardId);
      if (!boardId) {
        return false;
      }
      let device = null;
      if (boardId === az3166DeviceModule.AZ3166Device.boardId) {
        device = new az3166DeviceModule.AZ3166Device(
            this.extensionContext, this.channel, deviceLocation);
      } else if (boardId === ioTButtonDeviceModule.IoTButtonDevice.boardId) {
        device = new ioTButtonDeviceModule.IoTButtonDevice(
            this.extensionContext, deviceLocation);
      } else if (boardId === esp32DeviceModule.Esp32Device.boardId) {
        device = new esp32DeviceModule.Esp32Device(
            this.extensionContext, this.channel, deviceLocation);
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

      const functionPath = ConfigHandler.get<string>(ConfigKey.functionPath);
      if (functionPath) {
        const functionLocation = path.join(
            vscode.workspace.workspaceFolders[0].uri.fsPath, '..',
            functionPath);
        const functionApp = new azureFunctionsModule.AzureFunctions(
            functionLocation, functionPath, this.channel, null, [{
              component: iotHub,
              type: azureComponentConfigModule.DependencyType.Input
            }]);
        await functionApp.updateConfigSettings(loadTimeScaffoldType);
        await functionApp.load();
        this.componentList.push(functionApp);
      }

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
          const functionPath =
              ConfigHandler.get<string>(ConfigKey.functionPath);
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
      openInNewWindow: boolean) {
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
    await azureConfigFileHandler.createIfNotExists(createTimeScaffoldType);

    const workspace: Workspace = {folders: [], settings: {}};

    // Whatever the template is, we will always create the device.
    const deviceDir =
        path.join(this.projectRootPath, constants.deviceDefaultFolderName);

    if (!await FileUtility.directoryExists(createTimeScaffoldType, deviceDir)) {
      await FileUtility.mkdirRecursively(createTimeScaffoldType, deviceDir);
    }

    workspace.folders.push({path: constants.deviceDefaultFolderName});
    let device: Component;

    if (boardId === az3166DeviceModule.AZ3166Device.boardId) {
      device = new az3166DeviceModule.AZ3166Device(
          this.extensionContext, this.channel, deviceDir, templateFilesInfo);
    } else if (boardId === ioTButtonDeviceModule.IoTButtonDevice.boardId) {
      device = new ioTButtonDeviceModule.IoTButtonDevice(
          this.extensionContext, deviceDir, templateFilesInfo);
    } else if (boardId === esp32DeviceModule.Esp32Device.boardId) {
      device = new esp32DeviceModule.Esp32Device(
          this.extensionContext, this.channel, deviceDir, templateFilesInfo);
    } else {
      throw new Error('The specified board is not supported.');
    }

    // Delay pre-requisite to compile / upload / deploy time instead of
    // creataion time. const isPrerequisitesAchieved = await
    // device.checkPrerequisites(); if (!isPrerequisitesAchieved) {
    //   return false;
    // }

    // Config through workspace
    workspace.settings[`IoTWorkbench.${ConfigKey.boardId}`] = boardId;
    this.componentList.push(device);

    workspace.settings[`IoTWorkbench.${ConfigKey.devicePath}`] =
        constants.deviceDefaultFolderName;

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
        const isIotHubPrerequisitesAchieved = await iothub.checkPrerequisites();
        if (!isIotHubPrerequisitesAchieved) {
          return;
        }

        const functionDir = path.join(
            this.projectRootPath, constants.functionDefaultFolderName);

        if (!await FileUtility.directoryExists(
                createTimeScaffoldType, functionDir)) {
          await FileUtility.mkdirRecursively(
              createTimeScaffoldType, functionDir);
        }

        workspace.folders.push({path: constants.functionDefaultFolderName});

        const azureFunctions = new azureFunctionsModule.AzureFunctions(
            functionDir, constants.functionDefaultFolderName, this.channel,
            null, [{
              component: iothub,
              type: azureComponentConfigModule.DependencyType.Input
            }] /*Dependencies*/);

        const isFunctionsPrerequisitesAchieved =
            await azureFunctions.checkPrerequisites();
        if (!isFunctionsPrerequisitesAchieved) {
          return;
        }

        workspace.settings[`IoTWorkbench.${ConfigKey.functionPath}`] =
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

        workspace.folders.push({path: constants.asaFolderName});
        workspace.settings[`IoTWorkbench.${ConfigKey.asaPath}`] =
            constants.asaFolderName;

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

    for (let i = 0; i < this.componentList.length; i++) {
      const res = await this.componentList[i].create();
      if (res === false) {
        // TODO: Remove this function and implement with sdk in FileUtility
        fs.removeSync(this.projectRootPath);
        vscode.window.showWarningMessage('Project initialize cancelled.');
        return;
      }
    }

    const workspaceConfigFilePath = path.join(
        this.projectRootPath,
        `${path.basename(this.projectRootPath)}${
            FileNames.workspaceExtensionName}`);

    await FileUtility.writeFile(
        createTimeScaffoldType, workspaceConfigFilePath,
        JSON.stringify(workspace, null, 4));

    const vscodeFolderPath =
        path.join(this.projectRootPath, FileNames.vscodeSettingsFolderName);
    if (!await FileUtility.directoryExists(
            createTimeScaffoldType, vscodeFolderPath)) {
      await FileUtility.mkdirRecursively(
          createTimeScaffoldType, vscodeFolderPath);
    }

    if (!openInNewWindow) {
      // If open in current window, VSCode will restart. Need to send telemetry
      // before VSCode restart to advoid data lost.
      try {
        telemetryModule.TelemetryWorker.sendEvent(
            EventNames.createNewProjectEvent, this.telemetryContext);
      } catch {
        // If sending telemetry failed, skip the error to avoid blocking user.
      }
    }

    // Configure project and open in container
    const projectEnvConfiger = new ProjectEnvironmentConfiger();
    projectEnvConfiger.configureProjectEnvironmentCore(
        this.extensionContext, this.channel, this.telemetryContext, deviceDir,
        PlatformType.Arduino, openInNewWindow);
  }

  async configureProjectEnv(
      channel: vscode.OutputChannel, telemetryContext: TelemetryContext,
      scaffoldType: ScaffoldType, configureRootPath: string,
      templateFilesInfo: TemplateFileInfo[], openInNewWindow: boolean) {
    // 1. Scaffold template files
    for (const fileInfo of templateFilesInfo) {
      await generateTemplateFile(configureRootPath, scaffoldType, fileInfo);
    }

    const projectRootPath = path.join(configureRootPath, '..');
    // 2. open project
    const workspaceConfigFilePath = path.join(
        projectRootPath,
        `${path.basename(projectRootPath)}${FileNames.workspaceExtensionName}`);
    setTimeout(
        () => vscode.commands.executeCommand(
            'iotcube.openLocally', workspaceConfigFilePath, openInNewWindow),
        500);

    const message =
        'Configuration is done. You can run \'Azure IoT Device Workbench: Compile Device Code\' command to compile device code';

    channelShowAndAppendLine(channel, message);
    vscode.window.showInformationMessage(message);
  }
}
