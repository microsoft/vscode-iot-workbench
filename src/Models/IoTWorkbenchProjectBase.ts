// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';
import { Component } from './Interfaces/Component';
import { TelemetryContext } from '../telemetry';
import { Provisionable } from './Interfaces/Provisionable';
import { Deployable } from './Interfaces/Deployable';
import { Compilable } from './Interfaces/Compilable';
import { Uploadable } from './Interfaces/Uploadable';
import { ProjectTemplate } from './Interfaces/ProjectTemplate';
import { ProjectType } from './Interfaces/ProjectType';

export abstract class IoTWorkbenchProjectBase {
  protected componentList: Component[];
  protected projectRootPath = '';
  protected extensionContext: vscode.ExtensionContext;
  protected channel: vscode.OutputChannel;
  protected telemetryContext: TelemetryContext;

  static GetProjectType(root: string): ProjectType{
    return ProjectType.Workspace;
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
    rootFolderPath: string, projectTemplateItem: ProjectTemplate,
    boardId: string, openInNewWindow: boolean): Promise<boolean>;
}
