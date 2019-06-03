// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';
import * as utils from '../utils';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, FileNames} from '../constants';
import {EventNames, DependentExtensions} from '../constants';
import {TelemetryProperties, TelemetryWorker} from '../telemetry';
import {askAndNewProject} from '../utils';

import {checkAzureLogin} from './Apis';
import {Compilable} from './Interfaces/Compilable';
import {Component, ComponentType} from './Interfaces/Component';
import {Deployable} from './Interfaces/Deployable';
import {Device} from './Interfaces/Device';
import {LibraryManageable} from './Interfaces/LibraryManageable';
import {ProjectTemplate, ProjectTemplateType, TemplateFileInfo} from './Interfaces/ProjectTemplate';
import {Provisionable} from './Interfaces/Provisionable';
import {Uploadable} from './Interfaces/Uploadable';
import {Workspace} from './Interfaces/Workspace';
import {RemoteExtension} from './RemoteExtension';
import {FileUtility} from '../FileUtility';

type Dependency = import('./AzureComponentConfig').Dependency;
type TelemetryContext = import('../telemetry').TelemetryContext;

const impor = require('impor')(__dirname);
const az3166DeviceModule =
    impor('./AZ3166Device') as typeof import('./AZ3166Device');
const azureComponentConfigModule =
    impor('./AzureComponentConfig') as typeof import('./AzureComponentConfig');
const azureFunctionsModule =
    impor('./AzureFunctions') as typeof import('./AzureFunctions');
const azureUtilityModule =
    impor('./AzureUtility') as typeof import('./AzureUtility');
const cosmosDBModule = impor('./CosmosDB') as typeof import('./CosmosDB');
const esp32DeviceModule =
    impor('./Esp32Device') as typeof import('./Esp32Device');
const ioTButtonDeviceModule =
    impor('./IoTButtonDevice') as typeof import('./IoTButtonDevice');
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
  workspaceConfigExtension: '.code-workspace',
  projectConfigFileName: 'projectConfig.json' // Use this file to store boardId since we currently use folder instead of workspace as a workaround
};

export class IoTProject {
  private componentList: Component[];
  private projectRootPath = '';
  private projectConfigFile = '';
  private extensionContext: vscode.ExtensionContext;
  private channel: vscode.OutputChannel;
  private telemetryContext: TelemetryContext;

  private canProvision(comp: {}): comp is Provisionable {
    return (comp as Provisionable).provision !== undefined;
  }

  private canDeploy(comp: {}): comp is Deployable {
    return (comp as Deployable).deploy !== undefined;
  }

  private canCompile(comp: {}): comp is Compilable {
    return (comp as Compilable).compile !== undefined;
  }

  private canUpload(comp: {}): comp is Uploadable {
    return (comp as Uploadable).upload !== undefined;
  }

  private canManageLibrary(comp: {}): comp is LibraryManageable {
    return (comp as LibraryManageable).manageLibrary !== undefined;
  }
  constructor(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    this.componentList = [];
    this.extensionContext = context;
    this.channel = channel;
    this.telemetryContext = telemetryContext;
  }

  async load(initLoad = false): Promise<boolean> {
    if (!vscode.workspace.workspaceFolders) {
      return false;
    }

    // Check if it is an iot project workspace
    this.projectRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const iotWorkbenchProjectFile = 
      path.join(this.projectRootPath, FileNames.iotworkbenchprojectFileName);

    if (!fs.existsSync(iotWorkbenchProjectFile)) {
      return false;
    }

    this.projectConfigFile = path.join(this.projectRootPath, 
      FileNames.vscodeSettingsFolderName, constants.projectConfigFileName);
    if (!fs.existsSync(this.projectConfigFile)) {
      return false;
    }
    const projectConfigJson = require(this.projectConfigFile);

    // only send telemetry when the IoT project is load when VS Code opens
    if (initLoad) {
      const properties: TelemetryProperties = {
        result: 'Succeeded',
        error: '',
        errorMessage: ''
      };
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
    azureConfigFileHandler.createIfNotExistsInWorkspace();

    if (this.projectRootPath !== undefined) {
      const boardId = projectConfigJson[`${ConfigKey.boardId}`];
      if (!boardId) {
        return false;
      }
      let device = null;
      if (boardId === az3166DeviceModule.AZ3166Device.boardId) {
        device = new az3166DeviceModule.AZ3166Device(
            this.extensionContext, this.channel, this.projectRootPath);
      } else if (
        boardId === raspberryPiDeviceModule.RaspberryPiDevice.boardId) {
      device = new raspberryPiDeviceModule.RaspberryPiDevice(
          this.extensionContext, this.projectRootPath, this.channel);
    }
      if (device) {
        this.componentList.push(device);
        await device.load();
      }
    }

    const componentConfigs = await azureConfigFileHandler.getSortedComponents();
    if (!componentConfigs || componentConfigs.length === 0) {
      // Support backward compact
      const iotHub =
          new ioTHubModule.IoTHub(this.projectRootPath, this.channel);
      await iotHub.updateConfigSettings();
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

  async handleLoadFailure() {
    if (!vscode.workspace.workspaceFolders ||
        !vscode.workspace.workspaceFolders[0] ||
        !fs.existsSync(this.projectConfigFile)) {
      await askAndNewProject(this.telemetryContext);
      return;
    }

    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const workbenchFileName =
        path.join(rootPath, FileNames.iotworkbenchprojectFileName);

    if (!fs.existsSync(workbenchFileName)) {
      await askAndNewProject(this.telemetryContext);
      return;
    }

    const projectConfigJson = require(this.projectConfigFile);
    const boardId = projectConfigJson[`${ConfigKey.boardId}`];
    if (!boardId) {
      // Handles situation when boardId in project config file is wrongly modified by user.
      const message = `Board Id cannot be found in ${this.projectConfigFile}. File may have been wrongly modified.`;
      this.channel.show();
      this.channel.appendLine(message);
      throw new Error(message);
    }

    throw new Error(`unknown load failure`);
  }

  async compile(): Promise<boolean> {
    for (const item of this.componentList) {
      if (this.canCompile(item)) {
        const isPrerequisitesAchieved = await item.checkPrerequisites();
        if (!isPrerequisitesAchieved) {
          return false;
        }

        const res = await item.compile();
        if (res === false) {
          const error = new Error(
              'Unable to compile the device code, please check output window for detail.');
          throw error;
        }
      }
    }
    return true;
  }

  async upload(): Promise<boolean> {
    for (const item of this.componentList) {
      if (this.canUpload(item)) {
        const isPrerequisitesAchieved = await item.checkPrerequisites();
        if (!isPrerequisitesAchieved) {
          return false;
        }

        const res = await item.upload();
        if (res === false) {
          const error = new Error(
              'Unable to upload the sketch, please check output window for detail.');
          throw error;
        }
      }
    }
    return true;
  }

  async manageLibrary(): Promise<boolean> {
    for (const item of this.componentList) {
      if (this.canManageLibrary(item)) {
        const isPrerequisitesAchieved = await item.checkPrerequisites();
        if (!isPrerequisitesAchieved) {
          return false;
        }

        const res = await item.manageLibrary();
        if (res === false) {
          const error = new Error(
              'Unable to manage libraries, please check output window for detail.');
          throw error;
        }
      }
    }
    return true;
  }

  async provision(): Promise<boolean> {
    const provisionItemList: string[] = [];
    for (const item of this.componentList) {
      if (this.canProvision(item)) {
        const isPrerequisitesAchieved = await item.checkPrerequisites();
        if (!isPrerequisitesAchieved) {
          return false;
        }

        provisionItemList.push(item.name);
      }
    }

    if (provisionItemList.length === 0) {
      // nothing to provision:
      vscode.window.showInformationMessage(
          'Congratulations! There is no Azure service to provision in this project.');
      return false;
    }

    // Ensure azure login before component provision
    let subscriptionId: string|undefined = '';
    let resourceGroup: string|undefined = '';
    if (provisionItemList.length > 0) {
      await checkAzureLogin();
      azureUtilityModule.AzureUtility.init(this.extensionContext, this.channel);
      resourceGroup = await azureUtilityModule.AzureUtility.getResourceGroup();
      subscriptionId = azureUtilityModule.AzureUtility.subscriptionId;
      if (!resourceGroup || !subscriptionId) {
        return false;
      }
    } else {
      return false;
    }

    for (const item of this.componentList) {
      const _provisionItemList: string[] = [];
      if (this.canProvision(item)) {
        for (let i = 0; i < provisionItemList.length; i++) {
          if (provisionItemList[i] === item.name) {
            _provisionItemList[i] = `>> ${i + 1}. ${provisionItemList[i]}`;
          } else {
            _provisionItemList[i] = `${i + 1}. ${provisionItemList[i]}`;
          }
        }
        const selection = await vscode.window.showQuickPick(
            [{
              label: _provisionItemList.join('   -   '),
              description: '',
              detail: 'Click to continue'
            }],
            {ignoreFocusOut: true, placeHolder: 'Provision process'});

        if (!selection) {
          return false;
        }

        const res = await item.provision();
        if (res === false) {
          vscode.window.showWarningMessage('Provision canceled.');
          return false;
        }
      }
    }
    return true;
  }

  async deploy(): Promise<boolean> {
    let azureLoggedIn = false;

    const deployItemList: string[] = [];
    for (const item of this.componentList) {
      if (this.canDeploy(item)) {
        const isPrerequisitesAchieved = await item.checkPrerequisites();
        if (!isPrerequisitesAchieved) {
          return false;
        }

        deployItemList.push(item.name);
      }
    }

    if (deployItemList && deployItemList.length <= 0) {
      await vscode.window.showInformationMessage(
          'Congratulations! The project does not contain any Azure components to be deployed.');
      return false;
    }

    if (!azureLoggedIn) {
      azureLoggedIn = await checkAzureLogin();
    }

    for (const item of this.componentList) {
      const _deployItemList: string[] = [];
      if (this.canDeploy(item)) {
        for (let i = 0; i < deployItemList.length; i++) {
          if (deployItemList[i] === item.name) {
            _deployItemList[i] = `>> ${i + 1}. ${deployItemList[i]}`;
          } else {
            _deployItemList[i] = `${i + 1}. ${deployItemList[i]}`;
          }
        }
        const selection = await vscode.window.showQuickPick(
            [{
              label: _deployItemList.join('   -   '),
              description: '',
              detail: 'Click to continue'
            }],
            {ignoreFocusOut: true, placeHolder: 'Deploy process'});

        if (!selection) {
          return false;
        }

        const res = await item.deploy();
        if (res === false) {
          const error = new Error(`The deployment of ${item.name} failed.`);
          throw error;
        }
      }
    }

    vscode.window.showInformationMessage('Azure deploy succeeded.');

    return true;
  }

  async create(
      rootFolderPath: string, templateFilesInfo: TemplateFileInfo[],
      projectType: ProjectTemplateType, boardId: string,
      openInNewWindow: boolean): Promise<boolean> {
    const rootFolderPathExists = await FileUtility.existsInLocal(rootFolderPath);
    if (!rootFolderPathExists) {
      throw new Error(
          'Unable to find the root path, please open the folder and initialize project again.');
    }

    this.projectRootPath = rootFolderPath;

    // initialize the storage for azure component settings
    const azureConfigFileHandler =
        new azureComponentConfigModule.AzureConfigFileHandler(
            this.projectRootPath);
    azureConfigFileHandler.createIfNotExistsInLocal();

    const projectConfig :{[key: string]: string} = {};
    
    let device: Component;
    if (boardId === az3166DeviceModule.AZ3166Device.boardId) {
      device = new az3166DeviceModule.AZ3166Device(
          this.extensionContext, this.channel, this.projectRootPath, templateFilesInfo);
      } else if (boardId === raspberryPiDeviceModule.RaspberryPiDevice.boardId) {
        device = new raspberryPiDeviceModule.RaspberryPiDevice(
            this.extensionContext, this.projectRootPath, this.channel,
            templateFilesInfo);
    } else {
      throw new Error('The specified board is not supported.');
    }

    const isPrerequisitesAchieved = await device.checkPrerequisites();
    if (!isPrerequisitesAchieved) {
      return false;
    }

    projectConfig[`${ConfigKey.boardId}`] = boardId;
    this.componentList.push(device);

    switch (projectType) {
      case ProjectTemplateType.Basic:
        // Save data to configFile
        break;
      case ProjectTemplateType.IotHub: {
        const iothub =
            new ioTHubModule.IoTHub(this.projectRootPath, this.channel);
        const isPrerequisitesAchieved = await iothub.checkPrerequisites();
        if (!isPrerequisitesAchieved) {
          return false;
        }
        this.componentList.push(iothub);
        break;
      }
      case ProjectTemplateType.AzureFunctions: {
        const iothub =
            new ioTHubModule.IoTHub(this.projectRootPath, this.channel);
        const isIotHubPrerequisitesAchieved = await iothub.checkPrerequisites();
        if (!isIotHubPrerequisitesAchieved) {
          return false;
        }

        const functionDir = path.join(this.projectRootPath, constants.functionDefaultFolderName);

        if (!await FileUtility.existsInLocal(functionDir)) {
          await FileUtility.mkdirRecursivelyInLocal(functionDir);
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
          return false;
        }

        projectConfig[`IoTWorkbench.${ConfigKey.functionPath}`] =
            constants.functionDefaultFolderName;

        this.componentList.push(iothub);
        this.componentList.push(azureFunctions);
        break;
      }
      case ProjectTemplateType.StreamAnalytics: {
        const iothub =
            new ioTHubModule.IoTHub(this.projectRootPath, this.channel);
        const isIotHubPrerequisitesAchieved = await iothub.checkPrerequisites();
        if (!isIotHubPrerequisitesAchieved) {
          return false;
        }

        const cosmosDB = new cosmosDBModule.CosmosDB(
            this.extensionContext, this.projectRootPath, this.channel);
        const isCosmosDBPrerequisitesAchieved =
            await cosmosDB.checkPrerequisites();
        if (!isCosmosDBPrerequisitesAchieved) {
          return false;
        }

        const asaDir = path.join(this.projectRootPath, constants.asaFolderName);

        if (!await FileUtility.existsInLocal(asaDir)) {
          await FileUtility.mkdirRecursivelyInLocal(asaDir);
        }

        const asaFilePath = this.extensionContext.asAbsolutePath(
            path.join(FileNames.resourcesFolderName, 'asaql', 'query.asaql'));
        const queryPath = path.join(asaDir, 'query.asaql');
        const asaQueryContent =
            fs.readFileSync(asaFilePath, 'utf8')
                .replace(/\[input\]/, `"iothub-${iothub.id}"`)
                .replace(/\[output\]/, `"cosmosdb-${cosmosDB.id}"`);
        await FileUtility.writeFileInLocal(queryPath, asaQueryContent);

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
        const isAsaPrerequisitesAchieved = await asa.checkPrerequisites();
        if (!isAsaPrerequisitesAchieved) {
          return false;
        }

        projectConfig[`IoTWorkbench.${ConfigKey.asaPath}`] =
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

    try {
      for (let i = 0; i < this.componentList.length; i++) {
        const res = await this.componentList[i].create();
        if (res === false) {
          fs.removeSync(this.projectRootPath);
          vscode.window.showWarningMessage('Project initialize canceled.');
          return false;
        }
      }
    } catch (error) {
      throw error;
    }

    const vscodeFolderPath = path.join(this.projectRootPath, FileNames.vscodeSettingsFolderName);
    if (!await FileUtility.existsInLocal(vscodeFolderPath)) {
      await FileUtility.mkdirRecursivelyInLocal(vscodeFolderPath);
    }
    const projectConfigFile = path.join(vscodeFolderPath, constants.projectConfigFileName);
    if (!await FileUtility.existsInLocal(projectConfigFile)) {
      const indentationSpace = 4;
      FileUtility.writeFileInLocal(projectConfigFile, JSON.stringify(projectConfig, null, indentationSpace));
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
      if (!RemoteExtension.isRemote(this.extensionContext)) {
          const res = await RemoteExtension.checkRemoteExtension();
          if (!res) {
            const message = `Remote extension is not available. Please install ${DependentExtensions.remote} first.`;
            this.channel.show();
            this.channel.appendLine(message);
            return false;
        }
      }
      setTimeout(
        // TODO: better implement this through VS Remote API.
        // Currently implemented in helper extension iotcube.
          () => vscode.commands.executeCommand('iotcube.openInContainer', this.projectRootPath),
          500); // TODO: Remove this magic number

      return true;
    } catch (error) {
      throw error;
    }
  }

  async configDeviceSettings(): Promise<boolean> {
    for (const component of this.componentList) {
      if (component.getComponentType() === ComponentType.Device) {
        const device = component as Device;
        try {
          await device.configDeviceSettings();
        } catch (error) {
          throw error;
        }
      }
    }
    return true;
  }
}
