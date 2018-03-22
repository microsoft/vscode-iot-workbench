// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export enum ProjectTemplateType {
  Basic = 1,
  IotHub,
  Function
}

export interface ProjectTemplate {
  label: string;
  detail: string;
  description: string;
  type: string;
  sketch: string;
}
