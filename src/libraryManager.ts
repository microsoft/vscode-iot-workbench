// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';
import {ProjectTemplate, ProjectTemplateType, TemplateFileInfo} from './Models/Interfaces/ProjectTemplate';
import * as utils from './utils';
import {Board, BoardQuickPickItem} from './Models/Interfaces/Board';
import {Platform} from './Models/Interfaces/Platform';
import {TelemetryContext} from './telemetry';
import {FileNames} from './constants';
import {BoardProvider} from './boardProvider';
import {IoTWorkbenchSettings} from './IoTSettings';

const impor = require('impor')(__dirname);
const azureFunctionsModule = impor('./Models/AzureFunctions') as
    typeof import('./Models/AzureFunctions');
const ioTProjectModule =
    impor('./Models/IoTProject') as typeof import('./Models/IoTProject');

const constants = {
  defaultProjectName: 'IoTproject'
};

export class LibraryManager {
  async ManageLibrary(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext) {}
}