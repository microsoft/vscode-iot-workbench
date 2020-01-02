// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export enum ProjectTemplateType {
  Basic = 'Basic',
  IotHub = 'IotHub',
  AzureFunctions = 'AzureFunctions',
  StreamAnalytics = 'StreamAnalytics'
}

export interface TemplateFileInfo {
  fileName: string;
  sourcePath: string;
  targetPath: string;
  fileContent?: string;
  overwrite?: boolean;
}

export interface TemplatesType { templates: ProjectTemplate[]; }
export interface ProjectTemplate {
  platform: string;
  name: string;
  detail: string;
  description: string;
  path: string;
  boardId: string;
  type: string;
  tag: string;
  connectionType: string;
}

export interface PnpDeviceConnection {
  name: string;
  type: string;
  detail: string;
}

export interface CodeGenProjectTemplate {
  language: string;
  name: string;
  supportedPlatforms: string[];
  type: string;
  detail: string;
  enabled: boolean;
}

export interface DeviceSdkReference {
  type: string;
  name: string;
  detail: string;
}

export interface Platform {
  name: string;
  id: string;
  description: string;
}

export interface DeviceConfig {
  label: string;
  description: string;
  detail: string;
}