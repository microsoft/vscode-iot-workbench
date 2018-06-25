// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export enum ProjectTemplateType {
  Basic = 1,
  IotHub,
  AzureFunctions
}

export interface ProjectTemplateBasic {
  label: string;
  detail: string;
  description: string;
  type: string;
}


export interface ArduinoProjectTemplate extends ProjectTemplateBasic {
  sketch: string;
}

export interface MbedLibrary {
  name: string;
  url: string;
}

export interface MbedProjectTemplate extends ProjectTemplateBasic {
  type: string;
  profile: string;
  additionalFiles: string[];
  libraries: MbedLibrary[];
}

// Consider a better name for this
export interface SimpleProjectTemplate extends ProjectTemplateBasic {
  additionalFiles: string[];
}