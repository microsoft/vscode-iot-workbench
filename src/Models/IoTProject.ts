import * as fs from 'fs-plus';
import * as path from 'path';

import {exceptionHelper} from '../exceptionHelper';

import {AZ3166Device} from './AZ3166Device';
import {Component} from './Interfaces/Component';
import {Provisionable} from './Interfaces/Provisionable';
import {IoTHub} from './IoTHub';

const constants = {
  deviceDefaultFolderName: 'Device',
  functionDefaultFolderName: 'Function',
  configFileName: 'iotstudio.config.json'
};

const jsonConstants = {
  DevicePath: 'DevicePath',
  IoTHubName: 'IoTHubName'
};

interface ProjectSettings {
  name: string;
  value: string;
}

export enum ProjectTemplateType {
  basic = 1,
  IotHub,
  Function
}

export class IoTProject {
  private componentList: Component[];
  private projectRootPath: string;
  private projectType: ProjectTemplateType;

  private addComponent(comp: Component) {}

  private canProvision(comp: {}): comp is Provisionable {
    return (comp as Provisionable).provision !== undefined;
  }

  constructor() {
    this.componentList = [];
  }

  load(folderPath: string): boolean {
    return true;
  }

  compile(): boolean {
    return true;
  }

  upload(): boolean {
    return true;
  }

  provision(): boolean {
    for (const item of this.componentList) {
      if (this.canProvision(item)) {
        // TODO: provision each components
      }
    }
    return true;
  }

  deploy(): boolean {
    return true;
  }

  create(rootFolderPath: string, templateType: ProjectTemplateType): boolean {
    if (!fs.existsSync(rootFolderPath)) {
      exceptionHelper(
          new Error(
              'Unable to find the root path, please open the folder and initialize project again.'),
          true);
    }

    this.projectRootPath = rootFolderPath;
    this.projectType = templateType;

    // Whatever the template is, we will always create the device.
    const deviceDir =
        path.join(this.projectRootPath, constants.deviceDefaultFolderName);

    if (!fs.existsSync(deviceDir)) {
      fs.mkdirSync(deviceDir);
    }

    const device = new AZ3166Device(deviceDir);
    this.componentList.push(device);

    const projSettings = {projectsettings: [] as ProjectSettings[]};
    projSettings.projectsettings.push(
        {name: jsonConstants.DevicePath, value: deviceDir});

    switch (templateType) {
      case ProjectTemplateType.basic:
        // Save data to configFile
        break;
      case ProjectTemplateType.IotHub:
        const iothub = new IoTHub();
        // In setting file, create a place holder for iothub name
        projSettings.projectsettings.push(
            {name: jsonConstants.IoTHubName, value: ''});
        this.componentList.push(iothub);
        break;
      case ProjectTemplateType.Function:
      default:
        break;
    }

    const configFilePath =
        path.join(this.projectRootPath, constants.configFileName);
    const jsonToSave = JSON.stringify(projSettings, null, 4);
    fs.writeFileSync(configFilePath, jsonToSave);

    // Component level creation
    this.componentList.forEach((element: Component) => {
      element.create();
    });

    return true;
  }

  setDeviceConnectionString(deviceConnectionString: string): boolean {
    return true;
  }
}
