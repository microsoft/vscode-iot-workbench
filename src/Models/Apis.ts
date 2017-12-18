import * as vscode from 'vscode';
import {ApiName} from './Interfaces/Api';

export function getExtensionApi(name: ApiName): any {
  switch(name) {
    case ApiName.Toolkit:
      return vscode.extensions.getExtension("vsciot-vscode.azure-iot-toolkit")!.exports;
    default:
      return null;
  }
}