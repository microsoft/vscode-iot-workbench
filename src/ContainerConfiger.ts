// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as utils from './utils';

import {TelemetryContext} from './telemetry';
import {FileNames, ScaffoldType, PlatformType, TemplateTag} from './constants';
import {IoTWorkbenchSettings} from './IoTSettings';
import {FileUtility} from './FileUtility';
import {ProjectTemplate, ProjectTemplateType, TemplatesType} from './Models/Interfaces/ProjectTemplate';
import {Platform} from './Models/Interfaces/Platform';
import {RemoteExtension} from './Models/RemoteExtension';

const impor = require('impor')(__dirname);
const ioTWorkspaceProjectModule = impor('./Models/IoTWorkspaceProject') as
    typeof import('./Models/IoTWorkspaceProject');
const ioTContainerizedProjectModule =
    impor('./Models/IoTContainerizedProject') as
    typeof import('./Models/IoTContainerizedProject');

export class ContainerConfiger {
  configureContainer(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {
    // Only create project when not in remote environment
    const notRemote = RemoteExtension.checkNotRemoteBeforeRunCommand(context);
    if (!notRemote) {
      return;
    }
    // TODO
  }
}