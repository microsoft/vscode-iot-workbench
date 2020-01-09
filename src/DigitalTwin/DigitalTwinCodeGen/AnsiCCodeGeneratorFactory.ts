import * as vscode from 'vscode';

import { TelemetryContext } from '../../telemetry';
import { AnsiCCodeGenerator } from './Interfaces/AnsiCCodeGenerator';
import { CodeGenerator, CodeGenLanguage } from './Interfaces/CodeGenerator';
import { CodeGeneratorFactory } from './Interfaces/CodeGeneratorFactory';

export class AnsiCCodeGeneratorFactory implements CodeGeneratorFactory {
  constructor(
      private context: vscode.ExtensionContext,
      private channel: vscode.OutputChannel,
      private telemetryContext: TelemetryContext) {}
  createCodeGeneratorImpl(language: string): CodeGenerator|null {
    if (language === CodeGenLanguage.ANSIC.toString()) {
      return new AnsiCCodeGenerator(
        this.context, this.channel, this.telemetryContext);
    } else {
      return null;
    }
  }
}