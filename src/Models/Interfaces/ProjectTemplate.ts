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
export interface ProjectTemplate {
  platform: string;
  name: string;
  detail: string;
  description: string;
  path: string;
  projectHostType: string;
  boardId: string;
  type: string;
  tag: string;
  connectionType: string;
}

export interface PnpDeviceConnectionType {
  name: string;
  type: string;
  detail: string;
}

export interface PnpProjectTemplateType {
  language: string;
  name: string;
  type: string;
  detail: string;
}
