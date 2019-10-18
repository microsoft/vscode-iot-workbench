import * as vscode from 'vscode';

import {TelemetryContext} from '../../telemetry';

import {AnsiCCodeGeneratorImplCMake} from './AnsiCCodeGeneratorImplCMake';
import {AnsiCCodeGeneratorImplIoTDevKit} from './AnsiCCodeGeneratorImplIoTDevKit';
import {AnsiCCodeGeneratorImplVS} from './AnsiCCodeGeneratorImplVS';
import {CodeGenerator, CodeGenProjectType, DeviceConnectionType, DeviceSdkReferenceType} from './Interfaces/CodeGenerator';
import {CodeGeneratorFactory} from './Interfaces/CodeGeneratorFactory';

export class AnsiCCodeGeneratorFactory implements CodeGeneratorFactory {
  constructor(
      private context: vscode.ExtensionContext,
      private channel: vscode.OutputChannel,
      private telemetryContext: TelemetryContext) {}
  createCodeGeneratorImpl(
      projectType: CodeGenProjectType, sdkReferenceType: DeviceSdkReferenceType,
      connectionType: DeviceConnectionType): CodeGenerator|null {
    if (projectType === CodeGenProjectType.CMakeWindows ||
        projectType === CodeGenProjectType.CMakeLinux) {
      return new AnsiCCodeGeneratorImplCMake(
          projectType, sdkReferenceType, connectionType, this.context,
          this.channel);
    } else if (projectType === CodeGenProjectType.IoTDevKit) {
      return new AnsiCCodeGeneratorImplIoTDevKit(
          this.context, this.channel, this.telemetryContext, connectionType);
    } else if (projectType === CodeGenProjectType.VisualStudio) {
      return new AnsiCCodeGeneratorImplVS(
          this.context, this.channel, this.telemetryContext, connectionType);
    }

    return null;
  }
}