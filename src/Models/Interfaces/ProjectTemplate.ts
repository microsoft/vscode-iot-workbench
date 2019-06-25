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
}
export interface ProjectTemplate {
  label: string;
  detail: string;
  description: string;
  type: string;
  sketch: string;
}
