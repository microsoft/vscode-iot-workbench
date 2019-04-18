import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {FileNames} from '../constants';

import {DigitalTwinFileNames} from './DigitalTwinConstants';
import {PnPMetaModelGraph} from './PnPMetaModelGraph';

const impor = require('impor')(__dirname);
const request = impor('request-promise') as typeof import('request-promise');
type RequestOptions = import('request-promise').Options;

interface EtagObj {
  etag: string;
  lastModified: string;
}

interface EtagObjCache {
  [uri: string]: EtagObj;
}

class BlobService {
  constructor(private context: vscode.ExtensionContext) {}
  private getEtagObjCache() {
    const etagObjCacheFilePath = this.context.asAbsolutePath(path.join(
        FileNames.cacheFolderName, DigitalTwinFileNames.etagCacheFileName));
    if (fs.existsSync(etagObjCacheFilePath)) {
      const etagObjCacheRawFile = fs.readFileSync(etagObjCacheFilePath, 'utf8');
      const etagObjCache = JSON.parse(etagObjCacheRawFile) as EtagObjCache;
      return etagObjCache;
    }
    return {};
  }
  private updateEtagObjCache(etagObjCache: EtagObjCache) {
    const etagObjCacheFilePath = this.context.asAbsolutePath(path.join(
        FileNames.cacheFolderName, DigitalTwinFileNames.etagCacheFileName));
    fs.writeFileSync(
        etagObjCacheFilePath, JSON.stringify(etagObjCache, null, 2));
  }
  private getEtag(uri: string) {
    const etagObjCache = this.getEtagObjCache();
    if (etagObjCache[uri]) {
      return etagObjCache[uri];
    }
    return null;
  }
  private updateEtagObj(uri: string, etag: string, lastModified: string) {
    const etagObjCache = this.getEtagObjCache();
    etagObjCache[uri] = {etag, lastModified};
    this.updateEtagObjCache(etagObjCache);
  }
  async getFile(uri: string) {
    const options = {uri, resolveWithFullResponse: true} as RequestOptions;
    const etagObj = this.getEtag(uri);
    if (etagObj) {
      const headers = {
        'If-Modified-Since': etagObj.lastModified,
        'If-None-Match': etagObj.etag
      };
      options.headers = headers;
    }

    try {
      const res = await request(options);

      // request module regards 304 as an exception,
      // however, to be safe, still check status code here
      if (res.statusCode === 304) {
        return null;
      } else {
        const etag = res.headers['etag'];
        const lastModified = res.headers['last-modified'];
        if (etag && lastModified) {
          this.updateEtagObj(uri, etag, lastModified);
        }
        return res.body as string;
      }
    } catch (e) {
      // request regards 304 as an expection
      if (e.statusCode !== 304) {
        console.log(`Error occured when request remote file (${
            uri}) with status code ${e.statusCode}`);
      }
      return null;
    }
  }
}

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
  private blobService: BlobService;
  private graphUrl: string;
  private interfaceUrl: string;
  private capabilityModelUrl: string;

  constructor(private context: vscode.ExtensionContext) {
    this.blobService = new BlobService(this.context);
    const extensionPackage = require(context.asAbsolutePath('./package.json'));
    this.graphUrl = extensionPackage.graphUrl;
    this.interfaceUrl = extensionPackage.interfaceUrl;
    this.capabilityModelUrl = extensionPackage.capabilityModelUrl;
  }
  async getGraph() {
    const graphFileFromRemote = await this.blobService.getFile(this.graphUrl);
    const graphFilePath = this.context.asAbsolutePath(path.join(
        DigitalTwinFileNames.resourcesFolderName,
        DigitalTwinFileNames.deviceModelFolderName,
        DigitalTwinFileNames.graphFileName));
    const pnpGraphfaceString =
        graphFileFromRemote || fs.readFileSync(graphFilePath, 'utf8');
    if (graphFileFromRemote) {
      fs.writeFileSync(graphFilePath, graphFileFromRemote);
    }
    const pnpGraph: PnPMetaModelGraph = JSON.parse(pnpGraphfaceString);
    return pnpGraph;
  }
  async getInterface() {
    const interfaceFileFromRemote =
        await this.blobService.getFile(this.interfaceUrl);
    const interfaceFilePath = this.context.asAbsolutePath(path.join(
        DigitalTwinFileNames.resourcesFolderName,
        DigitalTwinFileNames.deviceModelFolderName,
        DigitalTwinFileNames.interfaceFileName));
    const pnpInterfaceString =
        interfaceFileFromRemote || fs.readFileSync(interfaceFilePath, 'utf8');
    if (interfaceFileFromRemote) {
      fs.writeFileSync(interfaceFilePath, interfaceFileFromRemote);
    }
    const pnpInterface: PnPMetaModelContext = JSON.parse(pnpInterfaceString);
    return pnpInterface;
  }
  async getCapabilityModel() {
    const capabilityModelFileFromRemote =
        await this.blobService.getFile(this.capabilityModelUrl);
    const capabilityModelFilePath = this.context.asAbsolutePath(path.join(
        DigitalTwinFileNames.resourcesFolderName,
        DigitalTwinFileNames.deviceModelFolderName,
        DigitalTwinFileNames.capabilityModelFileName));
    const pnpCapabilityModelString = capabilityModelFileFromRemote ||
        fs.readFileSync(capabilityModelFilePath, 'utf8');
    if (capabilityModelFileFromRemote) {
      fs.writeFileSync(capabilityModelFilePath, capabilityModelFileFromRemote);
    }
    const pnpCapabilityModel: PnPMetaModelContext =
        JSON.parse(pnpCapabilityModelString);
    return pnpCapabilityModel;
  }
}
