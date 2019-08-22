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
import {Platform, Container, ProjectTemplate, ProjectTemplateType, TemplatesType, ContainersType} from './Models/Interfaces/ProjectTemplate';
import {RemoteExtension} from './Models/RemoteExtension';
import {ProjectHostType} from './Models/Interfaces/ProjectHostType';
import * as UIUtility from './UIUtility';

const impor = require('impor')(__dirname);
const ioTWorkspaceProjectModule = impor('./Models/IoTWorkspaceProject') as
    typeof import('./Models/IoTWorkspaceProject');
const ioTContainerizedProjectModule =
    impor('./Models/IoTContainerizedProject') as
    typeof import('./Models/IoTContainerizedProject');

export class ProjectEnvironmentConfiger {
  async configureProjectEnvironment(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext,
      platform: PlatformType = PlatformType.Unknown) {
    // Only create project when not in remote environment
    const isLocal = RemoteExtension.checkLocalBeforeRunCommand(context);
    if (!isLocal) {
      return;
    }

    let openInNewWindow = false;
    // If current window contains other project, open the created project in new
    // window.
    if (vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length > 0) {
      openInNewWindow = true;
    }

    await vscode.window.withProgress(
        {
          title: 'Project environment configuration',
          location: vscode.ProgressLocation.Window,
        },
        async () => {
          const scaffoldType = ScaffoldType.Local;

          // Select platform if not specified
          if (platform === PlatformType.Unknown) {
            const platformSelection =
                await UIUtility.selectPlatform(scaffoldType, context);
            if (!platformSelection) {
              telemetryContext.properties.errorMessage =
                  'Platform selection cancelled.';
              telemetryContext.properties.result = 'Cancelled';
              return;
            } else {
              telemetryContext.properties.platform = platformSelection.label;
              platform = utils.getEnumKeyByEnumValue(PlatformType, platformSelection.label);
            }
          }

          if (platform === PlatformType.Arduino) {
            await this.configureWorkspaceProjectEnv();
          } else if (platform === PlatformType.EmbeddedLinux) {
            // Select container
            const templateJsonFilePath = context.asAbsolutePath(path.join(
                FileNames.resourcesFolderName,
                FileNames.templatesFolderName,
                FileNames.templateFileName));
            const templateJsonFileString =
                await FileUtility.readFile(
                    scaffoldType, templateJsonFilePath, 'utf8') as string;
            const templateJson = JSON.parse(templateJsonFileString);
            if (!templateJson) {
              throw new Error('Fail to load template list.');
            }
        

            const containerSelection = await this.selectContainer(templateJson);
            if (!containerSelection) {
              telemetryContext.properties.errorMessage =
                  'Container selection cancelled.';
              telemetryContext.properties.result = 'Cancelled';
              return;
            } else {
              telemetryContext.properties.platform = containerSelection.label;
            }

            const containerItem =
                templateJson.templates.find((template: ProjectTemplate) => {
                  return template.name === containerSelection.label;
                });

            // Configure the selected container environment for the project
            await this.configureContainerProjectEnv(containerItem.path);
          } else {
            throw new Error(`Unsupported Platform type!`);
          }

          return;
        });
  }

  private async configureWorkspaceProjectEnv() {
    // 
  }

  private async configureContainerProjectEnv(containerTemplateFileName: string) {
    // 
  }

  private async selectContainer(templateListJson: TemplatesType):
      Promise<vscode.QuickPickItem|undefined> {
    const containerTemplates =
        templateListJson.templates.filter((template: ProjectTemplate) => {
              return (template.tag === TemplateTag.DevelopmentEnvironment);
            });

    const containerList: vscode.QuickPickItem[] = [];
    containerTemplates.forEach((container: ProjectTemplate) => {
      containerList.push(
          {label: container.name, description: container.description});
    });

    const containerSelection =
        await vscode.window.showQuickPick(containerList, {
          ignoreFocusOut: true,
          matchOnDescription: true,
          matchOnDetail: true,
          placeHolder: 'Select a platform',
        });

    return containerSelection;
  }
}