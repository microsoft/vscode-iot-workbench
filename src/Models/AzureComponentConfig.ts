import * as path from "path";

import { AzureComponentsStorage, ScaffoldType } from "../constants";
import { FileUtility } from "../FileUtility";

import { Component } from "./Interfaces/Component";
import { ComponentType } from "./Interfaces/Component";
import { ArgumentEmptyOrNullError } from "../common/Error/OperationFailedErrors/ArgumentEmptyOrNullError";

// TODO: need to check what value should be included here
export interface ComponentInfo {
  values: { [key: string]: string };
}

export enum DependencyType {
  Other,
  Input,
  Output
}

export interface DependencyConfig {
  id: string;
  type: DependencyType;
}

export interface AzureComponentConfig {
  id: string;
  type: ComponentType;
  name: string;
  folder: string;
  dependencies: DependencyConfig[];
  componentInfo?: ComponentInfo;
}

export interface AzureConfigs {
  componentConfigs: AzureComponentConfig[];
}

export interface Dependency {
  component: Component;
  type: DependencyType;
}

export class AzureConfigFileHandler {
  private projectRootPath: string;
  private configFilePath: string;

  constructor(projectRoot: string) {
    this.projectRootPath = projectRoot;
    this.configFilePath = path.join(
      this.projectRootPath,
      AzureComponentsStorage.folderName,
      AzureComponentsStorage.fileName
    );
  }

  async createIfNotExists(type: ScaffoldType): Promise<void> {
    const azureConfigs: AzureConfigs = { componentConfigs: [] };
    const azureConfigFolderPath = path.join(this.projectRootPath, AzureComponentsStorage.folderName);
    if (!(await FileUtility.directoryExists(type, azureConfigFolderPath))) {
      await FileUtility.mkdirRecursively(type, azureConfigFolderPath);
    }
    const azureConfigFilePath = path.join(azureConfigFolderPath, AzureComponentsStorage.fileName);

    if (!(await FileUtility.fileExists(type, azureConfigFilePath))) {
      await FileUtility.writeJsonFile(type, azureConfigFilePath, azureConfigs);
    }
  }

  static async loadAzureConfigs(type: ScaffoldType, configFilePath: string): Promise<AzureConfigs> {
    const azureConfigContent = await FileUtility.readFile(type, configFilePath, "utf8");
    const azureConfigs = JSON.parse(azureConfigContent as string) as AzureConfigs;
    return azureConfigs;
  }

  async getSortedComponents(type: ScaffoldType): Promise<AzureComponentConfig[]> {
    const azureConfigs = await AzureConfigFileHandler.loadAzureConfigs(type, this.configFilePath);
    const components: AzureComponentConfig[] = [];
    const componentConfigs = azureConfigs.componentConfigs;
    const sortedComponentIds: string[] = [];
    let lastSortedCount = 0;

    do {
      lastSortedCount = components.length;
      for (const componentConfig of componentConfigs) {
        if (sortedComponentIds.indexOf(componentConfig.id) > -1) {
          continue;
        }

        let hold = false;
        for (const dependency of componentConfig.dependencies) {
          if (sortedComponentIds.indexOf(dependency.id) === -1) {
            hold = true;
            break;
          }
        }

        if (hold) {
          continue;
        }

        sortedComponentIds.push(componentConfig.id);
        components.push(componentConfig);
      }
    } while (lastSortedCount < componentConfigs.length && lastSortedCount < components.length);
    return components;
  }

  async getComponentIndexById(type: ScaffoldType, id: string): Promise<number> {
    const azureConfigs = await AzureConfigFileHandler.loadAzureConfigs(type, this.configFilePath);
    const componentIndex = azureConfigs.componentConfigs.findIndex(config => config.id === id);
    return componentIndex;
  }

  async getComponentById(type: ScaffoldType, id: string): Promise<AzureComponentConfig | undefined> {
    const azureConfigs = await AzureConfigFileHandler.loadAzureConfigs(type, this.configFilePath);
    const componentConfig = azureConfigs.componentConfigs.find(config => config.id === id);
    return componentConfig;
  }

  async appendComponent(type: ScaffoldType, component: AzureComponentConfig): Promise<AzureConfigs> {
    const azureConfigs = await AzureConfigFileHandler.loadAzureConfigs(type, this.configFilePath);
    azureConfigs.componentConfigs.push(component);
    await FileUtility.writeJsonFile(type, this.configFilePath, azureConfigs);
    return azureConfigs;
  }

  async updateComponent(type: ScaffoldType, index: number, componentInfo: ComponentInfo): Promise<AzureConfigs> {
    const azureConfigs = await AzureConfigFileHandler.loadAzureConfigs(type, this.configFilePath);
    const component = azureConfigs.componentConfigs[index];
    if (!component) {
      throw new ArgumentEmptyOrNullError("update azure component", `component configurations of index ${index}.`);
    }
    component.componentInfo = componentInfo;
    await FileUtility.writeJsonFile(type, this.configFilePath, azureConfigs);
    return azureConfigs;
  }
}
