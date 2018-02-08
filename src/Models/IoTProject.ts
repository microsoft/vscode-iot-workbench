import {PreconditionFailedError} from 'azure-iot-common/lib/errors';
import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';

import {AZ3166Device, AZ3166SketchType} from './AZ3166Device';
import {AzureFunction} from './AzureFunction';
import {Compilable} from './Interfaces/Compilable';
import {Component, ComponentType} from './Interfaces/Component';
import {Deployable} from './Interfaces/Deployable';
import {Device, DeviceType} from './Interfaces/Device';
import {Provisionable} from './Interfaces/Provisionable';
import {Uploadable} from './Interfaces/Uploadable';
import {Workspace} from './Interfaces/Workspace';
import {IoTHub} from './IoTHub';

const constants = {
  deviceDefaultFolderName: 'Device',
  functionDefaultFolderName: 'Function',
  workspaceConfigFilePath: 'project.code-workspace'
};

const jsonConstants = {
  DevicePath: 'DevicePath',
  FunctionPath: 'FunctionPath',
  IoTHubName: 'IoTHubName'
};

interface ProjectSetting {
  name: string;
  value: string;
}

export enum ProjectTemplateType {
  basic = 1,
  IotHub,
  Function,
  Temperature
}

export class IoTProject {
  private componentList: Component[];
  private projectRootPath: string;
  private projectType: ProjectTemplateType;
  private extensionContext: vscode.ExtensionContext;
  private channel: vscode.OutputChannel;

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

  constructor(context: vscode.ExtensionContext, channel: vscode.OutputChannel) {
    this.componentList = [];
    this.extensionContext = context;
    this.channel = channel;
  }

  async load(): Promise<boolean> {
    if (!vscode.workspace.workspaceFolders) {
      return false;
    }

    const devicePath = ConfigHandler.get<string>(jsonConstants.DevicePath);
    if (!devicePath) {
      return false;
    }

    const deviceLocation = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath, '..', devicePath);

    if (deviceLocation !== undefined) {
      // we load an existing project, so AZ3166SketchType is useless here which
      // is used for project provision use AZ3166SketchType.emptySketch as a
      // placeholder
      const device = new AZ3166Device(
          this.extensionContext, deviceLocation, AZ3166SketchType.emptySketch);
      this.componentList.push(device);
    }

    const hubName = ConfigHandler.get<string>(jsonConstants.IoTHubName);

    if (hubName !== undefined) {
      const iotHub = new IoTHub(this.channel);
      this.componentList.push(iotHub);
    }

    if (!vscode.workspace.workspaceFolders) {
      return false;
    }

    const functionPath = ConfigHandler.get<string>(jsonConstants.FunctionPath);
    if (!functionPath) {
      return false;
    }

    const functionLocation = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath, '..', functionPath);

    if (functionLocation !== undefined) {
      const functionApp = new AzureFunction(functionLocation, this.channel);
      this.componentList.push(functionApp);
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
          const error = new Error('Compile failed.');
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
          const error = new Error('Upload failed.');
          throw error;
        }
      }
    }
    return true;
  }

  async provision(): Promise<boolean> {
    for (const item of this.componentList) {
      if (this.canProvision(item)) {
        const res = await item.provision();
        if (res === false) {
          const error = new Error('Provision failed.');
          throw error;
        }
      }
    }
    return true;
  }

  async deploy(): Promise<boolean> {
    for (const item of this.componentList) {
      if (this.canDeploy(item)) {
        const res = await item.deploy();
        if (res === false) {
          const error = new Error('Deploy failed.');
          throw error;
        }
      }
    }
    return true;
  }

  async create(rootFolderPath: string, templateType: ProjectTemplateType):
      Promise<boolean> {
    if (!fs.existsSync(rootFolderPath)) {
      throw new Error(
          'Unable to find the root path, please open the folder and initialize project again.');
    }

    this.projectRootPath = rootFolderPath;
    this.projectType = templateType;

    const workspace: Workspace = {folders: [], settings: {}};

    // Whatever the template is, we will always create the device.
    const deviceDir =
        path.join(this.projectRootPath, constants.deviceDefaultFolderName);

    if (!fs.existsSync(deviceDir)) {
      fs.mkdirSync(deviceDir);
    }

    workspace.folders.push({path: constants.deviceDefaultFolderName});
    let sketchType: AZ3166SketchType;
    switch (templateType) {
      case ProjectTemplateType.basic:
      case ProjectTemplateType.IotHub:
      case ProjectTemplateType.Function:
        sketchType = AZ3166SketchType.emptySketch;
        break;
      case ProjectTemplateType.Temperature:
        sketchType = AZ3166SketchType.sendTemrature;
        break;
      default:
        throw new Error('Invalid template.');
    }

    const device =
        new AZ3166Device(this.extensionContext, deviceDir, sketchType);
    this.componentList.push(device);

    // TODO: Consider naming for project level settings.
    const settings = {projectsettings: [] as ProjectSetting[]};
    settings.projectsettings.push({
      name: jsonConstants.DevicePath,
      value: constants.deviceDefaultFolderName
    });

    workspace.settings[`IoTDev.${jsonConstants.DevicePath}`] =
        constants.deviceDefaultFolderName;

    switch (templateType) {
      case ProjectTemplateType.basic:
        // Save data to configFile
        break;
      case ProjectTemplateType.IotHub:
      case ProjectTemplateType.Temperature: {
        const iothub = new IoTHub(this.channel);
        // In setting file, create a place holder for iothub name
        settings.projectsettings.push(
            {name: jsonConstants.IoTHubName, value: ''});
        workspace.settings[`IoTDev.${jsonConstants.IoTHubName}`] = '';
        this.componentList.push(iothub);
        break;
      }
      case ProjectTemplateType.Function: {
        const iothub = new IoTHub(this.channel);

        const functionDir = path.join(
            this.projectRootPath, constants.functionDefaultFolderName);

        if (!fs.existsSync(functionDir)) {
          fs.mkdirSync(functionDir);
        }

        workspace.folders.push({path: constants.functionDefaultFolderName});

        const azureFunction = new AzureFunction(functionDir, this.channel);
        // In setting file, create a place holder for iothub name
        settings.projectsettings.push(
            {name: jsonConstants.IoTHubName, value: ''});
        settings.projectsettings.push({
          name: jsonConstants.FunctionPath,
          value: constants.functionDefaultFolderName
        });

        workspace.settings[`IoTDev.${jsonConstants.IoTHubName}`] = '';
        workspace.settings[`IoTDev.${jsonConstants.FunctionPath}`] =
            constants.functionDefaultFolderName;

        this.componentList.push(iothub);
        this.componentList.push(azureFunction);
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
        await this.componentList[i].create();
      }
    } catch (error) {
      throw error;
    }

    const workspaceConfigFilePath =
        path.join(this.projectRootPath, constants.workspaceConfigFilePath);

    fs.writeFileSync(
        workspaceConfigFilePath, JSON.stringify(workspace, null, 4));
    try {
      await vscode.commands.executeCommand(
          'vscode.openFolder', vscode.Uri.file(workspaceConfigFilePath));
      return true;
    } catch (error) {
      throw error;
    }
  }

  async setDeviceConnectionString(): Promise<boolean> {
    for (const component of this.componentList) {
      if (component.getComponentType() === ComponentType.Device) {
        const device = component as Device;
        if (device.getDeviceType() === DeviceType.MXChip_AZ3166) {
          const az3166Device = device as AZ3166Device;
          try {
            await az3166Device.setDeviceConnectionString();
          } catch (error) {
            throw error;
          }
        }
      }
    }
    return true;
  }
}
