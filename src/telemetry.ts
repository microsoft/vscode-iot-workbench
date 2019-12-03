// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';

import {CancelOperationError} from './CancelOperationError';
import {DevelopEnvironment} from './constants';
import {ExceptionHelper} from './exceptionHelper';
import {RemoteExtension} from './Models/RemoteExtension';
import {NSAT} from './nsat';
import {WorkbenchExtension} from './WorkbenchExtension';


interface PackageInfo {
  name: string;
  version: string;
  aiKey: string;
}

/**
 * Operation result of telemetry
 */
export enum TelemetryResult {
  Succeeded = 'Succeeded',
  Failed = 'Failed',
  Cancelled = 'Cancelled',
}

/**
 * Context of telemetry
 */
export interface TelemetryContext {
  properties: {[key: string]: string};
  measurements: {[key: string]: number};
}

export class TelemetryWorker {
  private _reporter: TelemetryReporter|undefined;
  private _extensionContext: vscode.ExtensionContext|undefined;
  private static _instance: TelemetryWorker|undefined;
  private _isInternal = false;

  private constructor(context: vscode.ExtensionContext) {
    this._extensionContext = context;
    const packageInfo = this.getPackageInfo(context);
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
    this._isInternal = TelemetryWorker.isInternalUser();
  }

  static getInstance(context: vscode.ExtensionContext): TelemetryWorker {
    if (!TelemetryWorker._instance) {
      TelemetryWorker._instance = new TelemetryWorker(context);
    }
    return TelemetryWorker._instance;
  }

  /**
   * check if it is Microsoft internal user
   */
  private static isInternalUser(): boolean {
    const userDomain: string = process.env.USERDNSDOMAIN ?
        process.env.USERDNSDOMAIN.toLowerCase() :
        '';
    return userDomain.endsWith('microsoft.com');
  }

  /**
   * Create telemetry context
   */
  createContext(): TelemetryContext {
    const context: TelemetryContext = {properties: {}, measurements: {}};
    context.properties.result = TelemetryResult.Succeeded;
    context.properties.isInternal = this._isInternal.toString();
    if (this._extensionContext) {
      context.properties.developEnvironment =
          RemoteExtension.isRemote(this._extensionContext) ?
          DevelopEnvironment.RemoteEnv :
          DevelopEnvironment.LocalEnv;
    }
    return context;
  }

  /**
   * Send event telemetry
   * @param eventName event name
   * @param telemetryContext telemetry context
   */
  sendEvent(eventName: string, telemetryContext: TelemetryContext): void {
    if (!this._reporter) {
      return;
    }
    if (telemetryContext) {
      this._reporter.sendTelemetryEvent(
          eventName, telemetryContext.properties,
          telemetryContext.measurements);
    } else {
      this._reporter.sendTelemetryEvent(eventName);
    }
  }

  /**
   *
   * @param context
   * @param telemetryContext
   * @param outputChannel
   * @param eventName
   * @param enableSurvey
   * @param callback
   * @param additionalProperties
   */
  async callCommandWithTelemetry(
      context: vscode.ExtensionContext, telemetryContext: TelemetryContext,
      outputChannel: vscode.OutputChannel, eventName: string,
      enableSurvey: boolean,
      // tslint:disable-next-line:no-any
      callback:
          (context: vscode.ExtensionContext,
           outputChannel: vscode.OutputChannel,
           // tslint:disable-next-line:no-any
           telemetrycontext: TelemetryContext, ...args: any[]) => any,
      // tslint:disable-next-line:no-any
      additionalProperties?: {[key: string]: string},
      // tslint:disable-next-line:no-any
      ...commandArgs: any[]): Promise<any> {
    const start: number = Date.now();
    if (additionalProperties) {
      for (const key of Object.keys(additionalProperties)) {
        if (!telemetryContext.properties.hasOwnProperty(key)) {
          telemetryContext.properties[key] = additionalProperties[key];
        }
      }
    }

    try {
      return await Promise.resolve(callback.apply(
          null, [context, outputChannel, telemetryContext, ...commandArgs]));
      // return await callback(context, outputChannel, telemetryContext,
      // ...commandArgs);
    } catch (error) {
      telemetryContext.properties.errorMessage = error.message;
      if (error instanceof CancelOperationError) {
        telemetryContext.properties.result = TelemetryResult.Cancelled;
      } else {
        telemetryContext.properties.result = TelemetryResult.Failed;
      }
      ExceptionHelper.logError(outputChannel, error, true);
    } finally {
      const end: number = Date.now();
      telemetryContext.measurements.duration = (end - start) / 1000;
      try {
        this.sendEvent(eventName, telemetryContext);
        if (enableSurvey) {
          NSAT.takeSurvey(context);
        }
      } catch {
        // If sending telemetry failed, skip the error to avoid blocking user.
      }
    }
  }

  /**
   * dispose telemetry worker
   */
  async dispose() {
    if (this._reporter) {
      await this._reporter.dispose();
    }
  }

  /**
   * Get extension information
   */
  private getPackageInfo(context: vscode.ExtensionContext): PackageInfo
      |undefined {
    const extension = WorkbenchExtension.getExtension(context);
    if (extension) {
      const extensionPackage = extension.packageJSON;
      if (extensionPackage) {
        const packageInfo: PackageInfo = {
          name: extensionPackage.name,
          version: extensionPackage.version,
          aiKey: extensionPackage.aiKey
        };
        return packageInfo;
      }
    }
    return undefined;
  }
}
