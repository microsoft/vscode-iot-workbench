import * as fs from 'fs-plus';
import * as path from 'path';

import {AzureComponentsStorage} from '../constants';

import {Component} from './Interfaces/Component';
import {ComponentType} from './Interfaces/Component';

// TODO: need to check what value should be included here
export interface ComponentInfo {
  values: {[key: string]: string};
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
  type: string;
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
        this.projectRootPath, AzureComponentsStorage.folderName,
        AzureComponentsStorage.fileName);
  }

  createIfNotExists() {
    const azureConfigs: AzureConfigs = {componentConfigs: []};
    const azureConfigFolderPath =
        path.join(this.projectRootPath, AzureComponentsStorage.folderName);
    if (!fs.existsSync(azureConfigFolderPath)) {
      fs.mkdirSync(azureConfigFolderPath);
    }
    const azureConfigFilePath =
        path.join(azureConfigFolderPath, AzureComponentsStorage.fileName);

    if (!fs.existsSync(azureConfigFilePath)) {
      fs.writeFileSync(
          azureConfigFilePath, JSON.stringify(azureConfigs, null, 4));
    }
  }

  getSortedComponents() {
    try {
      const azureConfigs =
          JSON.parse(fs.readFileSync(this.configFilePath, 'utf8')) as
          AzureConfigs;
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

  getComponentIndexById(id: string) {
    try {
      const azureConfigs =
          JSON.parse(fs.readFileSync(this.configFilePath, 'utf8')) as
          AzureConfigs;
      const componentIndex =
          azureConfigs.componentConfigs.findIndex(config => config.id === (id));
      return componentIndex;
    } catch (error) {
      throw new Error('Invalid azure components config file.');
    }
  }

  getComponentById(id: string) {
    try {
      const azureConfigs =
          JSON.parse(fs.readFileSync(this.configFilePath, 'utf8')) as
          AzureConfigs;
      const componentConfig =
          azureConfigs.componentConfigs.find(config => config.id === (id));
      return componentConfig;
    } catch (error) {
      throw new Error('Invalid azure components config file.');
    }
  }

  getComponentByType(type: ComponentType|string) {
    try {
      const azureConfigs =
          JSON.parse(fs.readFileSync(this.configFilePath, 'utf8')) as
          AzureConfigs;
      const componentConfig = azureConfigs.componentConfigs.find(
          config => config.type ===
              (typeof type === 'string' ? type : ComponentType[type]));
      return componentConfig;
    } catch (error) {
      throw new Error('Invalid azure components config file.');
    }
  }

  getComponentsByType(type: ComponentType|string) {
    try {
      const azureConfigs =
          JSON.parse(fs.readFileSync(this.configFilePath, 'utf8')) as
          AzureConfigs;
      const componentConfig = azureConfigs.componentConfigs.filter(
          config => config.type ===
              (typeof type === 'string' ? type : ComponentType[type]));
      return componentConfig;
    } catch (error) {
      throw new Error('Invalid azure components config file.');
    }
  }

  appendComponent(component: AzureComponentConfig) {
    try {
      const azureConfigs =
          JSON.parse(fs.readFileSync(this.configFilePath, 'utf8')) as
          AzureConfigs;
      azureConfigs.componentConfigs.push(component);
      fs.writeFileSync(
          this.configFilePath, JSON.stringify(azureConfigs, null, 4));
      return azureConfigs;
    } catch (error) {
      throw new Error('Invalid azure components config file.');
    }
  }

  updateComponent(index: number, componentInfo: ComponentInfo) {
    try {
      const azureConfigs =
          JSON.parse(fs.readFileSync(this.configFilePath, 'utf8')) as
          AzureConfigs;
      const component = azureConfigs.componentConfigs[index];
      if (!component) {
        throw new Error('Invalid index of componet list.');
      }
      component.componentInfo = componentInfo;
      fs.writeFileSync(
          this.configFilePath, JSON.stringify(azureConfigs, null, 4));
      return azureConfigs;
    } catch (error) {
      throw new Error('Invalid azure components config file.');
    }
  }
}