import * as vscode from 'vscode';
import {extensionName} from './Interfaces/Api';

export function getExtension(name: extensionName): vscode.Extension<{}>|
    undefined {
  switch (name) {
    case extensionName.Toolkit:
      return vscode.extensions.getExtension('vsciot-vscode.azure-iot-toolkit');
    default:
      return undefined;
  }
}