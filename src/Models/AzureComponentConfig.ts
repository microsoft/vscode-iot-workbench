import * as fs from 'fs-plus';
import * as path from 'path';

import {AzureComponentsStorage} from '../constants';
import {Component} from './Interfaces/Component';
import {ComponentType} from './Interfaces/Component';
import {FileUtility} from '../FileUtility';

// TODO: need to check what value should be included here
export interface ComponentInfo { values: {[key: string]: string}; }

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
  type: string;
  name: string;
  folder: string;
  dependencies: DependencyConfig[];
  componentInfo?: ComponentInfo;
}

export interface AzureConfigs { componentConfigs: AzureComponentConfig[]; }

export interface Dependency {
  component: Component;
  type: DependencyType;
}

export class AzureConfigFileHandler {
  private projectRootPath: string;
  private configFilePath: string;

  private exists:((localPath: string) => Promise<boolean>) | undefined;
  private writeFile: ((filePath: string, data: string | Buffer) => Promise<void>) | undefined;
  private mkdirRecursively: ((dirPath: string) => Promise<void>) | undefined;

  constructor(projectRoot: string) {
    this.projectRootPath = projectRoot;
    this.configFilePath = path.join(
        this.projectRootPath, AzureComponentsStorage.folderName,
        AzureComponentsStorage.fileName);
  }


  async createIfNotExistsInWorkspace() {
    this.exists = FileUtility.existsInWorkspace;
    this.writeFile = FileUtility.writeFileInWorkspace;
    this.mkdirRecursively = FileUtility.mkdirRecursivelyInWorkspace;

    await this.createIfNotExistsCore();
  }

  async createIfNotExistsInLocal() {
    this.exists = FileUtility.existsInLocal;
    this.writeFile = FileUtility.writeFileInLocal;
    this.mkdirRecursively = FileUtility.mkdirRecursivelyInLocal;

    await this.createIfNotExistsCore();
  }

  async createIfNotExistsCore() {
    if (this.exists === undefined || this.writeFile === undefined || this.mkdirRecursively === undefined) {
      throw new Error(`File-related function is not correctly set.`);
    }
    const azureConfigs: AzureConfigs = {componentConfigs: []};
    const azureConfigFolderPath =
        path.join(this.projectRootPath, AzureComponentsStorage.folderName);
    if (!await this.exists(azureConfigFolderPath)) {
      try {
        await this.mkdirRecursively(azureConfigFolderPath);
      } catch (error) {
        throw new Error(`Failed to create azure config folder. Error message: ${error.message}`);
      }
    }
    const azureConfigFilePath =
        path.join(azureConfigFolderPath, AzureComponentsStorage.fileName);

    if (!await this.exists(azureConfigFilePath)) {
      await this.writeFile(azureConfigFilePath, JSON.stringify(azureConfigs, null, 4));
    }
  }

  async getSortedComponents() {
    try {
      const azureConfigContent = await FileUtility.readFileInWorkspace(this.configFilePath, 'utf8');
      const azureConfigs = JSON.parse(azureConfigContent) as AzureConfigs;
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
      } while (lastSortedCount < componentConfigs.length &&
               lastSortedCount < components.length);
      return components;
    } catch (error) {
      throw new Error('Invalid azure components config file.');
    }
  }

  async getComponentIndexById(id: string) {
    try {
      const azureConfigContent = await FileUtility.readFileInLocal(this.configFilePath, 'utf8');
      const azureConfigs = JSON.parse(azureConfigContent) as AzureConfigs;
      const componentIndex =
          azureConfigs.componentConfigs.findIndex(config => config.id === (id));
      return componentIndex;
    } catch (error) {
      throw new Error('Invalid azure components config file.');
    }
  }

  async getComponentById(id: string) {
    try {
      const azureConfigContent = await FileUtility.readFileInWorkspace(this.configFilePath, 'utf8');
      const azureConfigs = JSON.parse(azureConfigContent) as AzureConfigs;
      const componentConfig =
          azureConfigs.componentConfigs.find(config => config.id === (id));
      return componentConfig;
    } catch (error) {
      throw new Error('Invalid azure components config file.');
    }
  }

  async getComponentByType(type: ComponentType|string) {
    try {
      const azureConfigContent = await FileUtility.readFileInWorkspace(this.configFilePath, 'utf8');
      const azureConfigs = JSON.parse(azureConfigContent) as AzureConfigs;
      const componentConfig = azureConfigs.componentConfigs.find(
          config => config.type ===
              (typeof type === 'string' ? type : ComponentType[type]));
      return componentConfig;
    } catch (error) {
      throw new Error('Invalid azure components config file.');
    }
  }

  async getComponentsByType(type: ComponentType|string) {
    try {
      const azureConfigContent = await FileUtility.readFileInWorkspace(this.configFilePath, 'utf8');
      const azureConfigs = JSON.parse(azureConfigContent) as AzureConfigs;
      const componentConfig = azureConfigs.componentConfigs.filter(
          config => config.type ===
              (typeof type === 'string' ? type : ComponentType[type]));
      return componentConfig;
    } catch (error) {
      throw new Error('Invalid azure components config file.');
    }
  }

  async appendComponent(component: AzureComponentConfig) {
    try {
      const azureConfigContent = await FileUtility.readFileInLocal(this.configFilePath, 'utf8');
      const azureConfigs = JSON.parse(azureConfigContent) as AzureConfigs;
      azureConfigs.componentConfigs.push(component);
      await FileUtility.writeFileInLocal(
          this.configFilePath, JSON.stringify(azureConfigs, null, 4));
      return azureConfigs;
    } catch (error) {
      throw new Error('Invalid azure components config file.');
    }
  }

  async updateComponent(index: number, componentInfo: ComponentInfo) {
    try {
      const azureConfigContent = await FileUtility.readFileInLocal(this.configFilePath, 'utf8');
      const azureConfigs = JSON.parse(azureConfigContent) as AzureConfigs;
      const component = azureConfigs.componentConfigs[index];
      if (!component) {
        throw new Error('Invalid index of componet list.');
      }
      component.componentInfo = componentInfo;
      await FileUtility.writeFileInLocal(
          this.configFilePath, JSON.stringify(azureConfigs, null, 4));
      return azureConfigs;
    } catch (error) {
      throw new Error('Invalid azure components config file.');
    }
  }
}