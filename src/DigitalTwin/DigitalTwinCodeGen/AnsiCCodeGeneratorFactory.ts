import * as vscode from 'vscode';

import {TelemetryContext} from '../../telemetry';

import {AnsiCCodeGeneratorImpl_VS} from './AnsiCCodeGeneratorImpl_VS';
import {AnsiCCodeGeneratorImpl_IoTDevKit} from './AnsiCCodeGeneratorImpl_IoTDevKit';
import {AnsiCCodeGeneratorImpl_CMake} from './AnsiCCodeGeneratorImpl_CMake';
import {CodeGenerator, CodeGenProjectType, DeviceConnectionType} from './Interfaces/CodeGenerator';
import {CodeGeneratorFactory} from './Interfaces/CodeGeneratorFactory';

export class AnsiCCodeGeneratorFactory implements CodeGeneratorFactory {
  constructor(
      private context: vscode.ExtensionContext,
      private channel: vscode.OutputChannel,
      private telemetryContext: TelemetryContext) {}
  CreateCodeGeneratorImpl(
      projectType: CodeGenProjectType,
      connectionType: DeviceConnectionType): CodeGenerator|null {
    if (projectType === CodeGenProjectType.CMake) {
      return new AnsiCCodeGeneratorImpl_CMake(
          this.context, this.channel, this.telemetryContext, connectionType);
    } else if (projectType === CodeGenProjectType.IoTDevKit) {
      return new AnsiCCodeGeneratorImpl_IoTDevKit(
          this.context, this.channel, this.telemetryContext, connectionType);
    } else if (projectType === CodeGenProjectType.VisualStudio) {
      return new AnsiCCodeGeneratorImpl_VS(
          this.context, this.channel, this.telemetryContext, connectionType);
    }
    return null;
  }
}