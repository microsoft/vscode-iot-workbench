
import * as vscode from 'vscode';

import {TelemetryContext} from '../../telemetry';

import {CppCodeGenDevkitImpl} from './CppCodeGenDevkitImpl';
import {CppCodeGenGeneralImpl} from './CppCodeGenGeneralImpl';
import {CodeGenDeviceType, CodeGenerator} from './Interfaces/CodeGenerator';
import {CodeGeneratorFactory} from './Interfaces/CodeGeneratorFactory';

export class CppCodeGeneratorFactory implements CodeGeneratorFactory {
  constructor(
      private context: vscode.ExtensionContext,
      private channel: vscode.OutputChannel,
      private telemetryContext: TelemetryContext) {}

  CreateCodeGeneratorImpl(deviceType: CodeGenDeviceType): CodeGenerator|null {
    if (deviceType === CodeGenDeviceType.General) {
      return new CppCodeGenGeneralImpl(this.context, this.channel);
    } else if (deviceType === CodeGenDeviceType.IoTDevKit) {
      return new CppCodeGenDevkitImpl(
          this.context, this.channel, this.telemetryContext);
    }
    return null;
  }
}