import * as vscode from 'vscode';
import {extensionName} from './Interfaces/Api';

export function getExtension(name: extensionName) {
  switch (name) {
    case extensionName.Toolkit:
      const toolkit =
          vscode.extensions.getExtension('vsciot-vscode.azure-iot-toolkit');
      return toolkit ? toolkit.exports : undefined;
    default:
      return undefined;
  }
}