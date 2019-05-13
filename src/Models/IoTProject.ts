// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, FileNames, DependentExtensions} from '../constants';
import {EventNames} from '../constants';
import {TelemetryProperties, TelemetryWorker} from '../telemetry';
import {askAndNewProject, askAndOpenProject} from '../utils';

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
  workspaceConfigExtension: '.code-workspace',
  projectConfigFileName: 'projectConfig.json' // Use this file to store boardId since we currently use folder instead of workspace as a workaround
};

interface ProjectSetting {
  name: string;
  value: string;
}

export class IoTProject {
  private componentList: Component[];
  private projectRootPath = '';
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

  // Check whether the iot-workbench extension is currently in remote container or local
  private isRemote(context: vscode.ExtensionContext) {
    if (((vscode as any).ExtensionExecutionContext && (context as any).executionContext ===(vscode as any).ExtensionExecutionContext.Remote) ||
        (process.argv[0].indexOf(`${path.sep}.vscode-remote${path.sep}`) > 0)) {
        return true;
    }
    return false;
  }

  static async IsRemoteExtensionAvailable(): Promise<boolean> {
    if (!vscode.extensions.getExtension(DependentExtensions.remote)) {
      const choice = await vscode.window.showInformationMessage(
          'Remote extension is required for the current project. Do you want to install it from marketplace?',
          'Yes', 'No');
      if (choice === 'Yes') {
        vscode.commands.executeCommand(
            'vscode.open',
            vscode.Uri.parse(
                'vscode:extension/' + DependentExtensions.remote));
      }
      return false;
    }
    return true;
  }

  async checkRemoteExtension(): Promise<boolean> {
    const isRemoteExtensionAvailable = await IoTProject.IsRemoteExtensionAvailable();
    if (!isRemoteExtensionAvailable) {
      return false;
    }
    return true;
  }

  async load(initLoad = false): Promise<boolean> {
    if (!vscode.workspace.workspaceFolders) {
      return false;
    }

    if (this.isRemote(this.extensionContext)) {
      // The IoT project is open in remote side. Load the IoT project.
      this.projectRootPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath);
      const vscodeFolderPath = path.join(this.projectRootPath, FileNames.vscodeSettingsFolderName);
      const projectConfigFile = path.join(vscodeFolderPath, constants.projectConfigFileName);
      if (!fs.existsSync(vscodeFolderPath) && !fs.existsSync(projectConfigFile)) {
        return false;
      }
      const projectConfigJSON = require(projectConfigFile);

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
      azureConfigFileHandler.createIfNotExists();

      if (this.projectRootPath !== undefined) {
        const boardId = projectConfigJSON[`${ConfigKey.boardId}`];
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

      const componentConfigs = azureConfigFileHandler.getSortedComponents();
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
    } else {
      // The IoTproject is open locally. Open it in remote.
      try {
        if (this.checkRemoteExtension()) {
            await vscode.commands.executeCommand(`openindocker.reopenInContainer`);
        } else {
          throw Error(`The Remote Extension is not available. Failed to load the IoT project in remote.`);
        }
        return true;
      } catch (error) {
        throw error;
      }
    }
  }

  async handleLoadFailure() {
    // if (!vscode.workspace.workspaceFolders ||
    //     !vscode.workspace.workspaceFolders[0]) {
    //   await askAndNewProject(this.telemetryContext);
    //   return;
    // }

    // const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    // const workbenchFileName =
    //     path.join(rootPath, FileNames.iotworkbenchprojectFileName);

    // const workspaceFiles = fs.readdirSync(rootPath).filter(
    //     file => path.extname(file).endsWith(FileNames.workspaceExtensionName));

    // if (fs.existsSync(workbenchFileName) && workspaceFiles &&
    //     workspaceFiles[0]) {
    //   await askAndOpenProject(
    //       rootPath, workspaceFiles[0], this.telemetryContext);
    // } else {
    //   await askAndNewProject(this.telemetryContext);
    // }
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
    const devicePath = ConfigHandler.get<string>(ConfigKey.devicePath);
    if (!devicePath) {
      throw new Error(
          'Cannot run IoT Device Workbench command in a non-IoTWorkbench project. Please initialize an IoT Device Workbench project first.');
    }

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
    if (!fs.existsSync(rootFolderPath)) {
      throw new Error(
          'Unable to find the root path, please open the folder and initialize project again.');
    }

    this.projectRootPath = rootFolderPath;

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

    const type: ProjectTemplateType = projectType;

    switch (type) {
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
      // case ProjectTemplateType.AzureFunctions: {
      //   const iothub =
      //       new ioTHubModule.IoTHub(this.projectRootPath, this.channel);
      //   const isIotHubPrerequisitesAchieved = await iothub.checkPrerequisites();
      //   if (!isIotHubPrerequisitesAchieved) {
      //     return false;
      //   }

      //   const functionDir = path.join(
      //       this.projectRootPath, constants.functionDefaultFolderName);

      //   if (!fs.existsSync(functionDir)) {
      //     fs.mkdirSync(functionDir);
      //   }

      //   workspace.folders.push({path: constants.functionDefaultFolderName});

      //   const azureFunctions = new azureFunctionsModule.AzureFunctions(
      //       functionDir, constants.functionDefaultFolderName, this.channel,
      //       null, [{
      //         component: iothub,
      //         type: azureComponentConfigModule.DependencyType.Input
      //       }] /*Dependencies*/);
      //   const isFunctionsPrerequisitesAchieved =
      //       await azureFunctions.checkPrerequisites();
      //   if (!isFunctionsPrerequisitesAchieved) {
      //     return false;
      //   }
      //   settings.projectsettings.push({
      //     name: ConfigKey.functionPath,
      //     value: constants.functionDefaultFolderName
      //   });

      //   workspace.settings[`IoTWorkbench.${ConfigKey.functionPath}`] =
      //       constants.functionDefaultFolderName;

      //   this.componentList.push(iothub);
      //   this.componentList.push(azureFunctions);
      //   break;
      // }
      // case ProjectTemplateType.StreamAnalytics: {
      //   const iothub =
      //       new ioTHubModule.IoTHub(this.projectRootPath, this.channel);
      //   const isIotHubPrerequisitesAchieved = await iothub.checkPrerequisites();
      //   if (!isIotHubPrerequisitesAchieved) {
      //     return false;
      //   }

      //   const cosmosDB = new cosmosDBModule.CosmosDB(
      //       this.extensionContext, this.projectRootPath, this.channel);
      //   const isCosmosDBPrerequisitesAchieved =
      //       await cosmosDB.checkPrerequisites();
      //   if (!isCosmosDBPrerequisitesAchieved) {
      //     return false;
      //   }

      //   const asaDir = path.join(this.projectRootPath, constants.asaFolderName);

      //   if (!fs.existsSync(asaDir)) {
      //     fs.mkdirSync(asaDir);
      //   }

      //   const asaFilePath = this.extensionContext.asAbsolutePath(
      //       path.join(FileNames.resourcesFolderName, 'asaql', 'query.asaql'));
      //   const queryPath = path.join(asaDir, 'query.asaql');
      //   const asaQueryContent =
      //       fs.readFileSync(asaFilePath, 'utf8')
      //           .replace(/\[input\]/, `"iothub-${iothub.id}"`)
      //           .replace(/\[output\]/, `"cosmosdb-${cosmosDB.id}"`);
      //   fs.writeFileSync(queryPath, asaQueryContent);

      //   const asa = new streamAnalyticsJobModule.StreamAnalyticsJob(
      //       queryPath, this.extensionContext, this.projectRootPath,
      //       this.channel, [
      //         {
      //           component: iothub,
      //           type: azureComponentConfigModule.DependencyType.Input
      //         },
      //         {
      //           component: cosmosDB,
      //           type: azureComponentConfigModule.DependencyType.Other
      //         }
      //       ]);
      //   const isAsaPrerequisitesAchieved = await asa.checkPrerequisites();
      //   if (!isAsaPrerequisitesAchieved) {
      //     return false;
      //   }

      //   workspace.folders.push({path: constants.asaFolderName});
      //   workspace.settings[`IoTWorkbench.${ConfigKey.asaPath}`] =
      //       constants.asaFolderName;

      //   this.componentList.push(iothub);
      //   this.componentList.push(cosmosDB);
      //   this.componentList.push(asa);
      //   break;
      // }
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
    if (!fs.existsSync(vscodeFolderPath)) {
      fs.mkdirSync(vscodeFolderPath);
    }
    const projectConfigFile = path.join(vscodeFolderPath, constants.projectConfigFileName);
    if (!fs.existsSync(projectConfigFile)) {
      fs.writeFileSync(projectConfigFile, JSON.stringify(projectConfig, null, 4));
    }
    // const workspaceConfigFilePath = path.join(
    //     this.projectRootPath,
    //     `${path.basename(this.projectRootPath)}${
    //         constants.workspaceConfigExtension}`);

    // fs.writeFileSync(
    //     workspaceConfigFilePath, JSON.stringify(workspace, null, 4));

    if (!openInNewWindow) {
      // Need to add telemetry here otherwise, after restart VSCode, no
      // telemetry data will be sent.
      try {
        telemetryModule.TelemetryWorker.sendEvent(
            EventNames.createNewProjectEvent, this.telemetryContext);
        // await vscode.commands.executeCommand('openindocker.reopenInContainer'); 
      } catch {
        // If sending telemetry failed, skip the error to avoid blocking user.
      }
    }

    try {
      
      setTimeout(
          () => vscode.commands.executeCommand(
              'vscode.openFolder', vscode.Uri.file(this.projectRootPath),
              false),
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
