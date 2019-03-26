import * as vscode from 'vscode';

import {TelemetryContext} from '../../telemetry';

import {AnciCCodeGenBoilerplateImpl} from './AnciCCodeGenBoilerplateImpl';
import {AnsiCCodeGenDevkitImpl} from './AnsiCCodeGenDevkitImpl';
import {AnsiCCodeGenGeneralImpl} from './AnsiCCodeGenGeneralImpl';
import {CodeGenDeviceType, CodeGenerator, ProvisionType} from './Interfaces/CodeGenerator';
import {CodeGeneratorFactory} from './Interfaces/CodeGeneratorFactory';

export class AnsiCCodeGeneratorFactory implements CodeGeneratorFactory {
  constructor(
      private context: vscode.ExtensionContext,
      private channel: vscode.OutputChannel,
      private telemetryContext: TelemetryContext) {}
  CreateCodeGeneratorImpl(
      deviceType: CodeGenDeviceType,
      provisionType: ProvisionType): CodeGenerator|null {
    if (deviceType === CodeGenDeviceType.General) {
      return new AnsiCCodeGenGeneralImpl(
          this.context, this.channel, this.telemetryContext, provisionType);
    } else if (deviceType === CodeGenDeviceType.IoTDevKit) {
      return new AnsiCCodeGenDevkitImpl(
          this.context, this.channel, this.telemetryContext, provisionType);
    } else if (deviceType === CodeGenDeviceType.Boilerplate) {
      return new AnciCCodeGenBoilerplateImpl(
          this.context, this.channel, this.telemetryContext);
    }
    return null;
  }
}