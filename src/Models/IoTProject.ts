// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey} from '../constants';
import {EventNames} from '../constants';
import {TelemetryContext, TelemetryWorker} from '../telemetry';

import {checkAzureLogin} from './Apis';
import {AZ3166Device} from './AZ3166Device';
import {AzureFunctions} from './AzureFunctions';
import {Esp32Device} from './Esp32Device';
import {Compilable} from './Interfaces/Compilable';
import {Component, ComponentType} from './Interfaces/Component';
import {Deployable} from './Interfaces/Deployable';
import {Device, DeviceType} from './Interfaces/Device';
import {ProjectTemplate, ProjectTemplateType} from './Interfaces/ProjectTemplate';
import {Provisionable} from './Interfaces/Provisionable';
import {Uploadable} from './Interfaces/Uploadable';
import {Workspace} from './Interfaces/Workspace';
import {IoTButtonDevice} from './IoTButtonDevice';
import {IoTHub} from './IoTHub';
import {IoTHubDevice} from './IoTHubDevice';
import {RaspberryPiDevice} from './RaspberryPiDevice';

const constants = {
  deviceDefaultFolderName: 'Device',
  functionDefaultFolderName: 'Functions',
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
      } else if (boardId === Esp32Device.boardId) {
        const device = new Esp32Device(this.extensionContext, deviceLocation);
      } else if (boardId === RaspberryPiDevice.boardId) {
        const device = new RaspberryPiDevice(
            this.extensionContext, deviceLocation, this.channel);
        this.componentList.push(device);
      }
    }

    const iotHub = new IoTHub(this.channel);
    this.componentList.push(iotHub);
    const device = new IoTHubDevice(this.channel);
    this.componentList.push(device);

    if (!vscode.workspace.workspaceFolders) {
      return false;
    }

    const functionPath = ConfigHandler.get<string>(ConfigKey.functionPath);
    if (functionPath) {
      const functionLocation = path.join(
          vscode.workspace.workspaceFolders[0].uri.fsPath, '..', functionPath);

      if (functionLocation) {
        const functionApp = new AzureFunctions(functionLocation, this.channel);
        this.componentList.push(functionApp);
      }
    }

    // Component level load
    this.componentList.forEach((element: Component) => {
      element.load();
    });
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
    if (provisionItemList.length > 0) {
      await checkAzureLogin();
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
        await vscode.window.showQuickPick(
            [{
              label: _provisionItemList.join('   -   '),
              description: '',
              detail: 'Click to continue'
            }],
            {ignoreFocusOut: true, placeHolder: 'Provision process'});

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
    let needDeploy = false;
    let azureLoggedIn = false;

    for (const item of this.componentList) {
      if (this.canDeploy(item)) {
        needDeploy = true;
        if (!azureLoggedIn) {
          azureLoggedIn = await checkAzureLogin();
        }

        const res = await item.deploy();
        if (res === false) {
          const error = new Error(`The deployment of ${item.name} failed.`);
          throw error;
        }
      }
    }

    if (!needDeploy) {
      await vscode.window.showWarningMessage(
          'The project does not contain any Azure components to be deployed, Azure Deploy skipped.');
    }

    return needDeploy;
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

    workspace.folders.push({path: constants.deviceDefaultFolderName});
    let device: Component;
    if (boardId === AZ3166Device.boardId) {
      device = new AZ3166Device(
          this.extensionContext, deviceDir, projectTemplateItem.sketch);
    } else if (boardId === IoTButtonDevice.boardId) {
      device = new IoTButtonDevice(
          this.extensionContext, deviceDir, projectTemplateItem.sketch);
    } else if (boardId === Esp32Device.boardId) {
      device = new Esp32Device(
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

    const type: ProjectTemplateType =
        (ProjectTemplateType)[projectTemplateItem.type as keyof typeof ProjectTemplateType];

    switch (type) {
      case ProjectTemplateType.Basic:
        // Save data to configFile
        break;
      case ProjectTemplateType.IotHub: {
        const iothub = new IoTHub(this.channel);
        this.componentList.push(iothub);
        break;
      }
      case ProjectTemplateType.AzureFunctions: {
        const iothub = new IoTHub(this.channel);

        const functionDir = path.join(
            this.projectRootPath, constants.functionDefaultFolderName);

        if (!fs.existsSync(functionDir)) {
          fs.mkdirSync(functionDir);
        }

        workspace.folders.push({path: constants.functionDefaultFolderName});

        const azureFunctions = new AzureFunctions(functionDir, this.channel);
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
