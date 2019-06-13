import * as vscode from 'vscode';

import {TelemetryContext} from '../../telemetry';

import {AnciCCodeGenBoilerplateImpl} from './AnciCCodeGenBoilerplateImpl';
import {AnsiCCodeGenVSImpl} from './AnciCCodeGenVSImpl';
import {AnsiCCodeGenDevkitImpl} from './AnsiCCodeGenDevkitImpl';
import {AnsiCCodeGenGeneralImpl} from './AnsiCCodeGenGeneralImpl';
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
      return new AnsiCCodeGenGeneralImpl(
          this.context, this.channel, this.telemetryContext, connectionType);
    } else if (projectType === CodeGenProjectType.IoTDevKit) {
      return new AnsiCCodeGenDevkitImpl(
          this.context, this.channel, this.telemetryContext, connectionType);
    } else if (projectType === CodeGenProjectType.VisualStudio) {
      return new AnsiCCodeGenVSImpl(
          this.context, this.channel, this.telemetryContext, connectionType);
    }
    return null;
  }
}