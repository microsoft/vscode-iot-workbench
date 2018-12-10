import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {PnPFileNames} from './PnPConstants';
import {PnPMetaModelGraph} from './PnPMetaModelGraph';

export interface PnPMetaModelContext {
  '@context': {
    '@vocab': string,
    [key: string]:
        string|{
          '@id': string
        }
  };
}

export class PnPMetaModelUtility {
  constructor(private context: vscode.ExtensionContext) {}
  getGraph() {
    const graphFilePath = this.context.asAbsolutePath(path.join(
        PnPFileNames.resourcesFolderName, PnPFileNames.deviceModelFolderName,
        PnPFileNames.graphFileName));
    const pnpGraphfaceString = fs.readFileSync(graphFilePath, 'utf8');
    const pnpGraph: PnPMetaModelGraph = JSON.parse(pnpGraphfaceString);
    return pnpGraph;
  }
  getInterface() {
    const interfaceFilePath = this.context.asAbsolutePath(path.join(
        PnPFileNames.resourcesFolderName, PnPFileNames.deviceModelFolderName,
        PnPFileNames.interfaceFileName));
    const pnpInterfaceString = fs.readFileSync(interfaceFilePath, 'utf8');
    const pnpInterface: PnPMetaModelContext = JSON.parse(pnpInterfaceString);
    return pnpInterface;
  }
  getCapabilityModel() {
    const capabilityModelFilePath = this.context.asAbsolutePath(path.join(
        PnPFileNames.resourcesFolderName, PnPFileNames.deviceModelFolderName,
        PnPFileNames.capabilityModelFileName));
    const pnpCapabilityModelString =
        fs.readFileSync(capabilityModelFilePath, 'utf8');
    const pnpCapabilityModel: PnPMetaModelContext =
        JSON.parse(pnpCapabilityModelString);
    return pnpCapabilityModel;
  }
}
