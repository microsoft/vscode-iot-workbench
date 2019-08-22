import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';

import {DevelopEnvironment} from './constants';
import {ExceptionHelper} from './exceptionHelper';
import {RemoteExtension} from './Models/RemoteExtension';
import {NSAT} from './nsat';
import {InternalConfig} from './utils';

interface PackageInfo {
  name: string;
  version: string;
  aiKey: string;
}


export interface TelemetryContext {
  properties: TelemetryProperties;
  measurements: TelemetryMeasurements;
}

export interface TelemetryProperties {
  result: 'Succeeded'|'Failed'|'Cancelled';
  error: string;
  errorMessage: string;
  [key: string]: string;
}

export interface TelemetryMeasurements {
  duration: number;
  [key: string]: number;
}


function getPackageInfo(context: vscode.ExtensionContext): PackageInfo|
    undefined {
  const extensionPackage = require(context.asAbsolutePath('./package.json'));
  if (extensionPackage) {
    const packageInfo: PackageInfo = {
      name: extensionPackage.name,
      version: extensionPackage.version,
      aiKey: extensionPackage.aiKey,
    };
    return packageInfo;
  }
  return undefined;
}

export class TelemetryWorker {
  private static _reporter: TelemetryReporter;

  static sendEvent(eventName: string, telemetryContext: TelemetryContext):
      void {
    if (this._reporter) {
      this._reporter.sendTelemetryEvent(
          eventName, telemetryContext.properties,
          telemetryContext.measurements);
    }
  }

  static async dispose() {
    if (this._reporter) {
      await this._reporter.dispose();
    }
  }

  static initialize(context: vscode.ExtensionContext): void {
    const packageInfo = getPackageInfo(context);
    if (!packageInfo) {
      console.log('Unable to initialize telemetry');
      return;
    }
    if (!packageInfo.aiKey) {
      console.log(
          'Unable to initialize telemetry, please make sure AIKey is set in package.json');
      return;
    }
    this._reporter = new TelemetryReporter(
        packageInfo.name, packageInfo.version, packageInfo.aiKey);
  }
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export async function callWithTelemetry(
    eventName: string, outputChannel: vscode.OutputChannel,
    enableSurvey: boolean, context: vscode.ExtensionContext,
    callback: (
        context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel,
        // tslint:disable-next-line:no-any
        telemetrycontext: TelemetryContext, ...args: any[]) => any,
    // tslint:disable-next-line:no-any
    additionalProperties?: {[key: string]: string},
    // tslint:disable-next-line:no-any
    ...args: any[]): Promise<any> {
  const start: number = Date.now();
  const properties:
      TelemetryProperties = {result: 'Succeeded', error: '', errorMessage: ''};

  if (additionalProperties) {
    for (const key of Object.keys(additionalProperties)) {
      if (!properties.hasOwnProperty(key)) {
        properties[key] = additionalProperties[key];
      }
    }
  }

  properties['isInternal'] =
      InternalConfig.isInternal === true ? 'true' : 'false';
  properties['developEnvironment'] = RemoteExtension.isRemote(context) ?
      DevelopEnvironment.Container :
      DevelopEnvironment.LocalEnv;
  const telemetryContext:
      TelemetryContext = {properties, measurements: {duration: 0}};

  try {
    return await Promise.resolve(callback.apply(
        null, [context, outputChannel, telemetryContext, ...args]));
  } catch (error) {
    telemetryContext.properties.result = 'Failed';
    telemetryContext.properties.error = error.errorType;
    telemetryContext.properties.errorMessage = error.message;
    ExceptionHelper.logError(outputChannel, error, true);
  } finally {
    const end: number = Date.now();
    telemetryContext.measurements.duration = (end - start) / 1000;
    try {
      TelemetryWorker.sendEvent(eventName, telemetryContext);
      if (enableSurvey) {
        NSAT.takeSurvey(context);
      }
    } catch {
      // If sending telemetry failed, skip the error to avoid blocking user.
    }
  }
}