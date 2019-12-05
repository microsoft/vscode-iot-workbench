// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as utils from './utils';

import {TelemetryContext} from './telemetry';
import {ScaffoldType, PlatformType} from './constants';
import {RemoteExtension} from './Models/RemoteExtension';
import {IoTWorkbenchProjectBase, OpenScenario} from './Models/IoTWorkbenchProjectBase';
import {ProjectHostType} from './Models/Interfaces/ProjectHostType';
import {CancelOperationError} from './CancelOperationError';

const impor = require('impor')(__dirname);
const ioTWorkspaceProjectModule = impor('./Models/IoTWorkspaceProject') as
    typeof import('./Models/IoTWorkspaceProject');
const ioTContainerizedProjectModule =
    impor('./Models/IoTContainerizedProject') as
    typeof import('./Models/IoTContainerizedProject');

export class ProjectEnvironmentConfiger {
  async configureProjectEnvironment(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext): Promise<void> {
    // Only configure project when not in remote environment
    const isLocal = RemoteExtension.checkLocalBeforeRunCommand(context);
    if (!isLocal) {
      return;
    }
    const scaffoldType = ScaffoldType.Local;

    // projectFileRootPath is the root path containing .iotworkbenchproject file
    const deviceRootPath = utils.getFirstWorkspaceFolderPath();
    if (!deviceRootPath) {
      return;
    }

    await vscode.window.withProgress(
        {
          title: 'Project environment configuration',
          location: vscode.ProgressLocation.Window,
        },
        async () => {
          // Select platform if not specified
          const platformSelection =
              await utils.selectPlatform(scaffoldType, context);
          let platform: PlatformType;
          if (!platformSelection) {
            throw new CancelOperationError(
                'Project environment configuration process cancelled: Platform selection cancelled.');
          } else {
            telemetryContext.properties.platform = platformSelection.label;
            platform = utils.getEnumKeyByEnumValue(
                PlatformType, platformSelection.label);
          }

          let res: boolean;
          res = await ProjectEnvironmentConfiger
                    .configureProjectEnvironmentAsPlatform(
                        context, channel, telemetryContext, platform,
                        deviceRootPath, scaffoldType);

          if (!res) {
            return;
          }

          const message = `Successfully configure project environment.`;
          utils.channelShowAndAppendLine(channel, message);
          vscode.window.showInformationMessage(message);
        });

    return;
  }

  static async configureProjectEnvironmentAsPlatform(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      telemetryContext: TelemetryContext, platform: PlatformType,
      deviceRootPath: string, scaffoldType: ScaffoldType): Promise<boolean> {
    if (platform === PlatformType.Arduino) {
      // First ensure the project is correctly open.
      const iotProject = await utils.constructAndLoadIoTProject(
          context, channel, telemetryContext);
      if (!iotProject) {
        return false;
      }

      // Validate platform.
      // Only iot workbench Arduino project created by workbench extension
      // can be configured as Arduino platform(for upgrade).
      const projectHostType = await IoTWorkbenchProjectBase.getProjectType(
          scaffoldType, deviceRootPath);
      if (projectHostType !== ProjectHostType.Workspace) {
        const message =
            `This is not an iot workbench Arduino projects. You cannot configure it as Arduino platform.`;
        utils.channelShowAndAppendLine(channel, message);
        vscode.window.showWarningMessage(message);
        return false;
      }
    }

    let project;
    if (platform === PlatformType.EmbeddedLinux) {
      await RemoteExtension.checkRemoteExtension();

      telemetryContext.properties.projectHostType = ProjectHostType.Container;
      project = new ioTContainerizedProjectModule.IoTContainerizedProject(
          context, channel, telemetryContext);

      // If external project, construct as RaspberryPi Device based
      // container iot workbench project
      if (!await project.configExternalProjectToIotProject(scaffoldType)) {
        return false;
      }
    } else if (platform === PlatformType.Arduino) {
      telemetryContext.properties.projectHostType = ProjectHostType.Workspace;
      project = new ioTWorkspaceProjectModule.IoTWorkspaceProject(
          context, channel, telemetryContext);
    } else {
      throw new Error('unsupported platform');
    }

    await project.load(scaffoldType);

    // Add configuration files
    await project.configureProjectEnvironmentCore(deviceRootPath, scaffoldType);

    await project.openProject(
        scaffoldType, false, OpenScenario.configureProject);
    return true;
  }
}