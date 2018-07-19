import {Component} from './Interfaces/Component';

// TODO: need to check what value should be included here
export interface ComponentInfo { values: {[key: string]: string}; }

export enum ComponentDependencyType {
  Input,
  Output
}

export interface ComponentDependency {
  id: string;
  type: ComponentDependencyType;
}

export interface AzureComponentConfig {
  id: string;
  type: string;
  name: string;
  folder: string;
  dependencies: ComponentDependency[];
  componentInfo?: ComponentInfo;
}

export interface AzureConfigs { componentConfigs: AzureComponentConfig[]; }

export interface DependentComponent {
  component: Component;
  type: ComponentDependencyType;
}