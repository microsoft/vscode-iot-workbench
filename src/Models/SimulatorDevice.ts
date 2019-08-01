// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import {TelemetryContext} from '../telemetry';
import {channelShowAndAppendLine} from '../utils';

import {ContainerDeviceBase} from './ContainerDeviceBase';
import {DeviceType} from './Interfaces/Device';
import {ProjectTemplateType, TemplateFileInfo} from './Interfaces/ProjectTemplate';


export class SimulatorDevice extends ContainerDeviceBase {
  private static _boardId = 'simulator';
  name = 'simulator';

  static get boardId() {
    return SimulatorDevice._boardId;
  }

  constructor(
      context: vscode.ExtensionContext, projectPath: string,
      channel: vscode.OutputChannel, projectTemplateType: ProjectTemplateType,
      telemetryContext: TelemetryContext,
      templateFilesInfo: TemplateFileInfo[] = []) {
    super(
        context, projectPath, channel, projectTemplateType, telemetryContext,
        DeviceType.Raspberry_Pi, templateFilesInfo);
  }

  async upload(): Promise<boolean> {
    channelShowAndAppendLine(
        this.channel, `Simulator does not support upload operation`);
    return true;
  }

  async configDeviceSettings(): Promise<boolean> {
    channelShowAndAppendLine(
        this.channel,
        `Simulator does not support config device setting operation`);
    return true;
  }
}