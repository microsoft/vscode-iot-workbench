import {Guid} from 'guid-typescript';

// TODO: need to check what value should be included here
export interface ComponentInfo { values: {[key: string]: string}; }

export interface AzureComponentConfig {
  id: string;
  type: string;
  name: string;
  folder: string;
  dependencies: string[];
  componentInfo?: ComponentInfo;
}

export interface AzureConfigs { componentConfigs: AzureComponentConfig[]; }