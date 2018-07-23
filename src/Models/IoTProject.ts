// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, FileNames} from '../constants';
import {AzureComponentsStorage, EventNames} from '../constants';
import {TelemetryContext, TelemetryWorker} from '../telemetry';

import {checkAzureLogin} from './Apis';
import {AZ3166Device} from './AZ3166Device';
import {AzureConfigFileHandler, AzureConfigs, Dependency, DependencyType} from './AzureComponentConfig';
import {AzureFunctions} from './AzureFunctions';
import {AzureUtility} from './AzureUtility';
import {Compilable} from './Interfaces/Compilable';
import {Component, ComponentType} from './Interfaces/Component';
import {Deployable} from './Interfaces/Deployable';
import {Device} from './Interfaces/Device';
import {ProjectTemplate, ProjectTemplateType} from './Interfaces/ProjectTemplate';
import {Provisionable} from './Interfaces/Provisionable';
import {Uploadable} from './Interfaces/Uploadable';
import {Workspace} from './Interfaces/Workspace';
import {IoTButtonDevice} from './IoTButtonDevice';
import {IoTHub} from './IoTHub';
import {IoTHubDevice} from './IoTHubDevice';
import {RaspberryPiDevice} from './RaspberryPiDevice';
import {StreamAnalyticsJob} from './StreamAnalyticsJob';

const constants = {
  deviceDefaultFolderName: 'Device',
  functionDefaultFolderName: 'Functions',
  asaFolderName: 'StreamAnalytics',
  workspaceConfigFilePath: 'project.code-workspace'
};

interface ProjectSetting {
  name: string;
  value: string;
}

export class IoTProject {
  private componentList: Component[];
  private projectRootPath = '';
  private projectTemplateItem: ProjectTemplate|null = null;
  private extensionContext: vscode.ExtensionContext;
  private channel: vscode.OutputChannel;
  private telemetryContext: TelemetryContext;

  private addComponent(comp: Component) {}

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

  constructor(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    this.componentList = [];
    this.extensionContext = context;
    this.channel = channel;
    this.telemetryContext = telemetryContext;
  }

  async load(): Promise<boolean> {
    if (!vscode.workspace.workspaceFolders) {
      return false;
    }

    const devicePath = ConfigHandler.get<string>(ConfigKey.devicePath);
    if (!devicePath) {
      return false;
    }

    this.projectRootPath =
        path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '..');
    const deviceLocation = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath, '..', devicePath);

    if (deviceLocation !== undefined) {
      const boardId = ConfigHandler.get<string>(ConfigKey.boardId);
      if (!boardId) {
        return false;
      }
      if (boardId === AZ3166Device.boardId) {
        const device = new AZ3166Device(this.extensionContext, deviceLocation);
        this.componentList.push(device);
      } else if (boardId === IoTButtonDevice.boardId) {
        const device =
            new IoTButtonDevice(this.extensionContext, deviceLocation);
        this.componentList.push(device);
      } else if (boardId === RaspberryPiDevice.boardId) {
        const device = new RaspberryPiDevice(
            this.extensionContext, deviceLocation, this.channel);
        this.componentList.push(device);
      }
    }

    const azureConfigFileHandler =
        new AzureConfigFileHandler(this.projectRootPath);
    const componentConfigs = azureConfigFileHandler.getSortedComponents();
    const components: {[key: string]: Component} = {};

    for (const componentConfig of componentConfigs) {
      switch (componentConfig.type) {
        case 'IoTHub': {
          const iotHub = new IoTHub(this.projectRootPath, this.channel);
          await iotHub.load();
          components[iotHub.id] = iotHub;
          this.componentList.push(iotHub);
          const device = new IoTHubDevice(this.channel);
          this.componentList.push(device);

          break;
        }
        case 'AzureFunctions': {
          if (!componentConfig.componentInfo ||
              !componentConfig.componentInfo.values ||
              !componentConfig.componentInfo.values.functionPath) {
            return false;
          }
          const functionPath =
              componentConfig.componentInfo.values.functionPath;
          const functionLocation = path.join(
              vscode.workspace.workspaceFolders[0].uri.fsPath, '..',
              functionPath);

          if (functionLocation) {
            const functionApp = new AzureFunctions(
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
          const asa = new StreamAnalyticsJob(
              queryPath, this.extensionContext, this.projectRootPath,
              this.channel, dependencies);
          await asa.load();
          components[asa.id] = asa;
          this.componentList.push(asa);
          break;
        }
        default: {
          throw new Error(
              `Component not supported with type of ${componentConfig.type}.`);
        }
      }
    }

    return true;
  }

  async compile(): Promise<boolean> {
    for (const item of this.componentList) {
      if (this.canCompile(item)) {
        const res = await item.compile();
        if (res === false) {
          const error = new Error(
              'Unable to compile the sketch, please check output window for detail.');
          throw error;
        }
      }
    }
    return true;
  }

  async upload(): Promise<boolean> {
    for (const item of this.componentList) {
      if (this.canUpload(item)) {
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

  async provision(): Promise<boolean> {
    const devicePath = ConfigHandler.get<string>(ConfigKey.devicePath);
    if (!devicePath) {
      throw new Error(
          'Cannot run IoT Workbench command in a non-IoTWorkbench project. Please initialize an IoT Workbench project first.');
    }

    const provisionItemList: string[] = [];
    for (const item of this.componentList) {
      if (this.canProvision(item)) {
        provisionItemList.push(item.name);
      }
    }

    // Ensure azure login before component provision
    let subscriptionId: string|undefined = '';
    let resourceGroup: string|undefined = '';
    if (provisionItemList.length > 0) {
      await checkAzureLogin();
      AzureUtility.init(this.extensionContext, this.channel);
      resourceGroup = await AzureUtility.getResourceGroup();
      subscriptionId = AzureUtility.subscriptionId;
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
    const needDeploy = false;
    let azureLoggedIn = false;

    const deployItemList: string[] = [];
    for (const item of this.componentList) {
      if (this.canDeploy(item)) {
        deployItemList.push(item.name);
      }
    }

    if (deployItemList && deployItemList.length <= 0) {
      await vscode.window.showWarningMessage(
          'The project does not contain any Azure components to be deployed, Azure Deploy skipped.');
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
      rootFolderPath: string, projectTemplateItem: ProjectTemplate,
      boardId: string, openInNewWindow: boolean): Promise<boolean> {
    if (!fs.existsSync(rootFolderPath)) {
      throw new Error(
          'Unable to find the root path, please open the folder and initialize project again.');
    }

    this.projectRootPath = rootFolderPath;
    this.projectTemplateItem = projectTemplateItem;

    const workspace: Workspace = {folders: [], settings: {}};

    // Whatever the template is, we will always create the device.
    const deviceDir =
        path.join(this.projectRootPath, constants.deviceDefaultFolderName);

    if (!fs.existsSync(deviceDir)) {
      fs.mkdirSync(deviceDir);
    }

    // initialize the storage for azure component settings
    const azureConfigs: AzureConfigs = {componentConfigs: []};
    const azureConfigFolderPath =
        path.join(this.projectRootPath, AzureComponentsStorage.folderName);
    if (!fs.existsSync(azureConfigFolderPath)) {
      fs.mkdirSync(azureConfigFolderPath);
    }
    const azureConfigFilePath =
        path.join(azureConfigFolderPath, AzureComponentsStorage.fileName);
    fs.writeFileSync(
        azureConfigFilePath, JSON.stringify(azureConfigs, null, 4));

    workspace.folders.push({path: constants.deviceDefaultFolderName});
    let device: Component;
    if (boardId === AZ3166Device.boardId) {
      device = new AZ3166Device(
          this.extensionContext, deviceDir, projectTemplateItem.sketch);
    } else if (boardId === IoTButtonDevice.boardId) {
      device = new IoTButtonDevice(
          this.extensionContext, deviceDir, projectTemplateItem.sketch);
    } else if (boardId === RaspberryPiDevice.boardId) {
      device = new RaspberryPiDevice(
          this.extensionContext, deviceDir, this.channel,
          projectTemplateItem.sketch);
    } else {
      throw new Error('The specified board is not supported.');
    }

    workspace.settings[`IoTWorkbench.${ConfigKey.boardId}`] = boardId;
    this.componentList.push(device);

    // TODO: Consider naming for project level settings.
    const settings = {projectsettings: [] as ProjectSetting[]};
    settings.projectsettings.push(
        {name: ConfigKey.devicePath, value: constants.deviceDefaultFolderName});

    workspace.settings[`IoTWorkbench.${ConfigKey.devicePath}`] =
        constants.deviceDefaultFolderName;

    const type: ProjectTemplateType = (ProjectTemplateType)
        [projectTemplateItem.type as keyof typeof ProjectTemplateType];

    switch (type) {
      case ProjectTemplateType.Basic:
        // Save data to configFile
        break;
      case ProjectTemplateType.IotHub: {
        const iothub = new IoTHub(this.projectRootPath, this.channel);
        this.componentList.push(iothub);
        break;
      }
      case ProjectTemplateType.AzureFunctions: {
        const iothub = new IoTHub(this.projectRootPath, this.channel);

        const functionDir = path.join(
            this.projectRootPath, constants.functionDefaultFolderName);

        if (!fs.existsSync(functionDir)) {
          fs.mkdirSync(functionDir);
        }

        workspace.folders.push({path: constants.functionDefaultFolderName});

        const azureFunctions = new AzureFunctions(
            functionDir, constants.functionDefaultFolderName, this.channel,
            null,
            [{component: iothub, type: DependencyType.Input}] /*Dependencies*/);
        settings.projectsettings.push({
          name: ConfigKey.functionPath,
          value: constants.functionDefaultFolderName
        });

        workspace.settings[`IoTWorkbench.${ConfigKey.functionPath}`] =
            constants.functionDefaultFolderName;

        this.componentList.push(iothub);
        this.componentList.push(azureFunctions);
        break;
      }
      case ProjectTemplateType.StreamAnalytics: {
        const iothub = new IoTHub(this.projectRootPath, this.channel);
        const asaDir = path.join(this.projectRootPath, constants.asaFolderName);

        if (!fs.existsSync(asaDir)) {
          fs.mkdirSync(asaDir);
        }

        const asaFilePath = this.extensionContext.asAbsolutePath(
            path.join(FileNames.resourcesFolderName, 'asaql', 'query.asaql'));
        const queryPath = path.join(asaDir, 'query.asaql');
        fs.copyFileSync(asaFilePath, queryPath);

        const asa = new StreamAnalyticsJob(
            queryPath, this.extensionContext, this.projectRootPath,
            this.channel, [{component: iothub, type: DependencyType.Input}]);

        workspace.folders.push({path: constants.asaFolderName});
        workspace.settings[`IoTWorkbench.${ConfigKey.asaPath}`] =
            constants.asaFolderName;

        this.componentList.push(iothub);
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

    const workspaceConfigFilePath =
        path.join(this.projectRootPath, constants.workspaceConfigFilePath);

    fs.writeFileSync(
        workspaceConfigFilePath, JSON.stringify(workspace, null, 4));

    if (!openInNewWindow) {
      // Need to add telemetry here otherwise, after restart VSCode, no
      // telemetry data will be sent.
      try {
        TelemetryWorker.sendEvent(
            EventNames.createNewProjectEvent, this.telemetryContext);
      } catch {
        // If sending telemetry failed, skip the error to avoid blocking user.
      }
    }

    try {
      setTimeout(
          () => vscode.commands.executeCommand(
              'vscode.openFolder', vscode.Uri.file(workspaceConfigFilePath),
              openInNewWindow),
          1000);
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
