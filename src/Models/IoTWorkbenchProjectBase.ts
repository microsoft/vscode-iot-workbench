// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {TelemetryContext} from '../telemetry';

import {Compilable} from './Interfaces/Compilable';
import {Component} from './Interfaces/Component';
import {Deployable} from './Interfaces/Deployable';
import {ProjectHostType} from './Interfaces/ProjectHostType';
import {ProjectTemplateType, TemplateFileInfo} from './Interfaces/ProjectTemplate';
import {Provisionable} from './Interfaces/Provisionable';
import {Uploadable} from './Interfaces/Uploadable';

export abstract class IoTWorkbenchProjectBase {
  protected componentList: Component[];
  protected projectRootPath = '';
  protected extensionContext: vscode.ExtensionContext;
  protected channel: vscode.OutputChannel;
  protected telemetryContext: TelemetryContext;

  static GetProjectType(root: string): ProjectHostType {
    // Add detailed logic to decide the project host type
    return ProjectHostType.Workspace;
  }

  canProvision(comp: {}): comp is Provisionable {
    return (comp as Provisionable).provision !== undefined;
  }

  canDeploy(comp: {}): comp is Deployable {
    return (comp as Deployable).deploy !== undefined;
  }

  canCompile(comp: {}): comp is Compilable {
    return (comp as Compilable).compile !== undefined;
  }

  canUpload(comp: {}): comp is Uploadable {
    return (comp as Uploadable).upload !== undefined;
  }

  constructor(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    this.componentList = [];
    this.extensionContext = context;
    this.channel = channel;
    this.telemetryContext = telemetryContext;
  }

  abstract async load(initLoad: boolean): Promise<boolean>;

  abstract async compile(): Promise<boolean>;

  abstract async upload(): Promise<boolean>;

  abstract async provision(): Promise<boolean>;

  abstract async deploy(): Promise<boolean>;

  abstract async create(
      rootFolderPath: string, templateFilesInfo: TemplateFileInfo[],
      projectType: ProjectTemplateType, boardId: string,
      openInNewWindow: boolean): Promise<boolean>;
}
