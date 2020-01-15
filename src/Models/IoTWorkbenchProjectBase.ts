// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as vscode from 'vscode';

import {CancelOperationError} from '../CancelOperationError';
import {ConfigKey, EventNames, FileNames, ScaffoldType} from '../constants';
import {FileUtility} from '../FileUtility';
import {TelemetryContext, TelemetryWorker} from '../telemetry';
import * as utils from '../utils';

import {checkAzureLogin} from './Apis';
import {Compilable} from './Interfaces/Compilable';
import {Component, ComponentType} from './Interfaces/Component';
import {Deployable} from './Interfaces/Deployable';
import {Device} from './Interfaces/Device';
import {ProjectHostType} from './Interfaces/ProjectHostType';
import {ProjectTemplateType, TemplateFileInfo} from './Interfaces/ProjectTemplate';
import {Provisionable} from './Interfaces/Provisionable';
import {Uploadable} from './Interfaces/Uploadable';

const impor = require('impor')(__dirname);
const azureUtilityModule =
    impor('./AzureUtility') as typeof import('./AzureUtility');

export enum OpenScenario {
  createNewProject,
  configureProject
}
export abstract class IoTWorkbenchProjectBase {
  protected extensionContext: vscode.ExtensionContext;
  protected channel: vscode.OutputChannel;
  protected telemetryContext: TelemetryContext;

  protected projectRootPath = '';
  protected iotWorkbenchProjectFilePath = '';

  protected componentList: Component[];
  protected projectHostType: ProjectHostType = ProjectHostType.Unknown;

  /**
   * projectHostType config is recoreded in iot workbench project file
   * @param scaffoldType
   * @param projectFileRootPath
   */
  static async getProjectType(
      scaffoldType: ScaffoldType,
      projectFileRootPath: string|undefined): Promise<ProjectHostType> {
    if (!projectFileRootPath) {
      return ProjectHostType.Unknown;
    }
    const iotWorkbenchProjectFile =
        path.join(projectFileRootPath, FileNames.iotWorkbenchProjectFileName);
    if (!await FileUtility.fileExists(scaffoldType, iotWorkbenchProjectFile)) {
      return ProjectHostType.Unknown;
    }
    const iotWorkbenchProjectFileString =
        (await FileUtility.readFile(
             scaffoldType, iotWorkbenchProjectFile, 'utf8') as string)
            .trim();
    if (iotWorkbenchProjectFileString) {
      const projectConfig = JSON.parse(iotWorkbenchProjectFileString);
      if (projectConfig &&
          projectConfig[`${ConfigKey.projectHostType}`] !== undefined) {
        const projectHostType: ProjectHostType = utils.getEnumKeyByEnumValue(
            ProjectHostType, projectConfig[`${ConfigKey.projectHostType}`]);
        return projectHostType;
      }
    }

    // TODO: For backward compatibility, will remove later
    const devcontainerFolderPath =
        path.join(projectFileRootPath, FileNames.devcontainerFolderName);
    if (await FileUtility.directoryExists(
            scaffoldType, devcontainerFolderPath)) {
      return ProjectHostType.Container;
    } else {
      return ProjectHostType.Workspace;
    }
  }

  canProvision(comp: {}): comp is Provisionable {
    return (comp as Provisionable).provision !== undefined;
  }

  canDeploy(comp: {}): comp is Deployable {
    return (comp as Deployable).deploy !== undefined;
  }

  canCompile(comp: {}): comp is Compilable {
    return (comp as Compilable).compile !== undefined;
  }

  canUpload(comp: {}): comp is Uploadable {
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

  abstract async load(scaffoldType: ScaffoldType, initLoad?: boolean):
      Promise<void>;

  abstract async create(
      templateFilesInfo: TemplateFileInfo[], projectType: ProjectTemplateType,
      boardId: string, openInNewWindow: boolean): Promise<void>;

  async compile(): Promise<boolean> {
    for (const item of this.componentList) {
      if (this.canCompile(item)) {
        const isPrerequisitesAchieved = await item.checkPrerequisites();
        if (!isPrerequisitesAchieved) {
          return false;
        }

        const res = await item.compile();
        if (!res) {
          vscode.window.showErrorMessage(
              'Unable to compile the device code, please check output window for detail.');
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
        if (!res) {
          vscode.window.showErrorMessage(
              'Unable to upload the sketch, please check output window for detail.');
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
        if (!res) {
          throw new CancelOperationError('Provision cancelled.');
        }
      }
    }
    return true;
  }

  async deploy() {
    let azureLoggedIn = false;

    const deployItemList: string[] = [];
    for (const item of this.componentList) {
      if (this.canDeploy(item)) {
        const isPrerequisitesAchieved = await item.checkPrerequisites();
        if (!isPrerequisitesAchieved) {
          return;
        }

        deployItemList.push(item.name);
      }
    }

    if (deployItemList && deployItemList.length <= 0) {
      await vscode.window.showInformationMessage(
          'Congratulations! The project does not contain any Azure components to be deployed.');
      return;
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
          throw new CancelOperationError(`Component deployment cancelled.`);
        }

        const res = await item.deploy();
        if (!res) {
          throw new Error(`The deployment of ${item.name} failed.`);
        }
      }
    }

    vscode.window.showInformationMessage('Azure deploy succeeded.');
  }

  /**
   * Configure project environment: Scaffold configuration files with the given
   * template files.
   */
  async configureProjectEnvironmentCore(
      deviceRootPath: string, scaffoldType: ScaffoldType): Promise<void> {
    for (const component of this.componentList) {
      if (component.getComponentType() === ComponentType.Device) {
        const device = component as Device;
        await device.configDeviceEnvironment(deviceRootPath, scaffoldType);
      }
    }
  }

  abstract async openProject(
      scaffoldType: ScaffoldType, openInNewWindow: boolean,
      openScenario: OpenScenario): Promise<void>;

  async configDeviceSettings(): Promise<boolean> {
    for (const component of this.componentList) {
      if (component.getComponentType() === ComponentType.Device) {
        const device = component as Device;
        await device.configDeviceSettings();
      }
    }
    return true;
  }

  /**
   * Send telemetry when the IoT project is load when VS Code opens
   */
  sendLoadEventTelemetry(context: vscode.ExtensionContext) {
    const telemetryWorker = TelemetryWorker.getInstance(context);
    try {
      telemetryWorker.sendEvent(
          EventNames.projectLoadEvent, this.telemetryContext);
    } catch {
      // If sending telemetry failed, skip the error to avoid blocking user.
    }
  }

  /**
   * Validate whether project root path exists. If not, throw error.
   * @param scaffoldType scaffold type
   */
  async validateProjectRootPath(scaffoldType: ScaffoldType): Promise<void> {
    if (!await FileUtility.directoryExists(
            scaffoldType, this.projectRootPath)) {
      throw new Error(`Project root path ${
          this.projectRootPath} does not exist. Please initialize the project first.`);
    }
  }
}
