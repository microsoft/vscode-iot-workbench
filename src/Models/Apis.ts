import * as vscode from 'vscode';

export function getApi(apiName: string): any {
  switch(apiName) {
    case 'azure-iot-toolkit':
      return vscode.extensions.getExtension("vsciot-vscode.azure-iot-toolkit")!.exports;
    default:
      return null;
  }
}