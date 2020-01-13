// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from "vscode";
import * as utils from "./utils";
import * as path from "path";

import { TelemetryContext } from "./telemetry";
import { ScaffoldType, PlatformType } from "./constants";
import { RemoteExtension } from "./Models/RemoteExtension";
import { IoTWorkbenchProjectBase, OpenScenario } from "./Models/IoTWorkbenchProjectBase";
import { ProjectHostType } from "./Models/Interfaces/ProjectHostType";
import { configExternalCMakeProjectToIoTContainerProject } from "./utils";
import { CancelOperationError } from "./CancelOperationError";

const impor = require("impor")(__dirname);
const ioTWorkspaceProjectModule = impor(
  "./Models/IoTWorkspaceProject"
) as typeof import("./Models/IoTWorkspaceProject");
const ioTContainerizedProjectModule = impor(
  "./Models/IoTContainerizedProject"
) as typeof import("./Models/IoTContainerizedProject");

export class ProjectEnvironmentConfiger {
  async configureCmakeProjectEnvironment(
    context: vscode.ExtensionContext,
    channel: vscode.OutputChannel,
    telemetryContext: TelemetryContext
  ): Promise<void> {
    // Only configure project when not in remote environment
    const isLocal = RemoteExtension.checkLocalBeforeRunCommand(context);
    if (!isLocal) {
      return;
    }

    const scaffoldType = ScaffoldType.Local;

    const projectRootPath = utils.getFirstWorkspaceFolderPath();
    if (!projectRootPath) {
      throw new Error(`Fail to get project root path.`);
    }

    await vscode.window.withProgress(
      {
        title: "CMake Project development container configuration",
        location: vscode.ProgressLocation.Window
      },
      async () => {
        await ProjectEnvironmentConfiger.configureProjectEnvironmentAsPlatform(
          context,
          channel,
          telemetryContext,
          PlatformType.EmbeddedLinux,
          projectRootPath,
          scaffoldType
        );

        const message = `Successfully configured development container for CMake project.`;
        utils.channelShowAndAppendLine(channel, message);
        vscode.window.showInformationMessage(message);
      }
    );

    return;
  }

  static async configureProjectEnvironmentAsPlatform(
    context: vscode.ExtensionContext,
    channel: vscode.OutputChannel,
    telemetryContext: TelemetryContext,
    platform: PlatformType,
    projectFileRootPath: string,
    scaffoldType: ScaffoldType
  ): Promise<void> {
    let project;
    if (platform === PlatformType.Arduino) {
      // Verify it is an iot workbench Arduino project
      const projectHostType = await IoTWorkbenchProjectBase.getProjectType(scaffoldType, projectFileRootPath);
      if (projectHostType !== ProjectHostType.Workspace) {
        const message = `This is not an iot workbench Arduino project. You cannot configure it as Arduino platform.`;
        vscode.window.showWarningMessage(message);
        throw new CancelOperationError(message);
      }

      const projectRootPath = path.join(projectFileRootPath, "..");
      project = new ioTWorkspaceProjectModule.IoTWorkspaceProject(context, channel, telemetryContext, projectRootPath);
      if (!project) {
        // Ensure the project is correctly open.
        await utils.properlyOpenIoTWorkspaceProject(telemetryContext);
      }
    } else if (platform === PlatformType.EmbeddedLinux) {
      // If external cmake project, configure to be IoT Workbench container
      // project
      await configExternalCMakeProjectToIoTContainerProject(scaffoldType);

      await RemoteExtension.checkRemoteExtension();

      project = new ioTContainerizedProjectModule.IoTContainerizedProject(
        context,
        channel,
        telemetryContext,
        projectFileRootPath
      );
    } else {
      throw new Error("unsupported platform");
    }

    await project.load(scaffoldType);

    // Add configuration files
    await project.configureProjectEnvironmentCore(projectFileRootPath, scaffoldType);

    await project.openProject(scaffoldType, false, OpenScenario.configureProject);
  }
}
