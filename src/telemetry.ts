import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';

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
  result: 'Succeeded'|'Failed'|'Canceled';
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

  static Initialize(context: vscode.ExtensionContext): void {
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