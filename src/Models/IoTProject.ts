import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {AZ3166Device} from './AZ3166Device';
import {AzureFunction} from './AzureFunction';
import {Compilable} from './Interfaces/Compilable';
import {Component, ComponentType} from './Interfaces/Component';
import {Deployable} from './Interfaces/Deployable';
import {Device, DeviceType} from './Interfaces/Device';
import {ProjectTemplate, ProjectTemplateType} from './Interfaces/ProjectTemplate';
import {Provisionable} from './Interfaces/Provisionable';
import {Uploadable} from './Interfaces/Uploadable';
import {Workspace} from './Interfaces/Workspace';
import {IoTHub} from './IoTHub';
import {IoTHubDevice} from './IoTHubDevice';
import { checkAzureLogin } from './Apis';
import { ConfigKey } from '../constants';
import { checkIoTDevProject } from '../utils';


const constants = {
  deviceDefaultFolderName: 'Device',
  functionDefaultFolderName: 'Function',
  workspaceConfigFilePath: 'project.code-workspace'
};

const jsonConstants = {
  FunctionPath: 'FunctionPath'
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

    const devicePath = ConfigHandler.get<string>(ConfigKey.devicePath);
    if (!devicePath) {
      return false;
    }

    const deviceLocation = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath, '..', devicePath);

    if (deviceLocation !== undefined) {
      const device = new AZ3166Device(this.extensionContext, deviceLocation);
      this.componentList.push(device);
    }

    const iotHub = new IoTHub(this.channel);
    this.componentList.push(iotHub);
    const device = new IoTHubDevice(this.channel);
    this.componentList.push(device);

    if (!vscode.workspace.workspaceFolders) {
      return false;
    }

    const functionPath = ConfigHandler.get<string>(jsonConstants.FunctionPath);
    if (functionPath) {
      const functionLocation = path.join(
          vscode.workspace.workspaceFolders[0].uri.fsPath, '..', functionPath);

      if (functionLocation) {
        const functionApp = new AzureFunction(functionLocation, this.channel);
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
      throw new Error("Cannot run IoT Dev command in a non-IoTDev project. Please initialize an IoT Dev project first.")
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
          const error = new Error(`The provision of ${item.name} failed.`);
          throw error;
        }
      }
    }
    return true;
  }

  async deploy(): Promise<boolean> {
    checkIoTDevProject();

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
      openInNewWindow: boolean): Promise<boolean> {
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

    const device = new AZ3166Device(
        this.extensionContext, deviceDir, projectTemplateItem.sketch);
    this.componentList.push(device);

    // TODO: Consider naming for project level settings.
    const settings = {projectsettings: [] as ProjectSetting[]};
    settings.projectsettings.push({
      name: ConfigKey.devicePath,
      value: constants.deviceDefaultFolderName
    });

    workspace.settings[`IoTDev.${ConfigKey.devicePath}`] =
        constants.deviceDefaultFolderName;

    const type: ProjectTemplateType = (ProjectTemplateType)
        [projectTemplateItem.type as keyof typeof ProjectTemplateType];

    switch (type) {
      case ProjectTemplateType.Basic:
        // Save data to configFile
        break;
      case ProjectTemplateType.IotHub: {
        const iothub = new IoTHub(this.channel);
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
        settings.projectsettings.push({
          name: jsonConstants.FunctionPath,
          value: constants.functionDefaultFolderName
        });

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
          'vscode.openFolder', vscode.Uri.file(workspaceConfigFilePath),
          openInNewWindow);
      return true;
    } catch (error) {
      throw error;
    }
  }

  async setDeviceConnectionString(): Promise<boolean> {
    checkIoTDevProject();

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
