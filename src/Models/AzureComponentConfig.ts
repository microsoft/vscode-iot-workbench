import {Component} from './Interfaces/Component';

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