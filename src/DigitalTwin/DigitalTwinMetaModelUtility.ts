import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {FileNames, GlobalConstants} from '../constants';

import {DigitalTwinFileNames} from './DigitalTwinConstants';
import {DigitalTwinMetaModelGraph} from './DigitalTwinMetaModelGraph';

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
        etagObjCacheFilePath,
        JSON.stringify(etagObjCache, null, GlobalConstants.indentationSpace));
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

export interface DigitalTwinMetaModelContext {
  '@context': {
    '@vocab': string,
    [key: string]:
        string|{
          '@id': string, '@container'?: string|null,
        }
  };
}

export class DigitalTwinMetaModelUtility {
  private blobService: BlobService;
  private graphUrl: string;
  private interfaceUrl: string;
  private capabilityModelUrl: string;
  private iotModelUrl: string;

  constructor(private context: vscode.ExtensionContext) {
    this.blobService = new BlobService(this.context);
    const extensionPackage = require(context.asAbsolutePath('./package.json'));
    this.graphUrl = extensionPackage.graphUrl;
    this.interfaceUrl = extensionPackage.interfaceUrl;
    this.capabilityModelUrl = extensionPackage.capabilityModelUrl;
    this.iotModelUrl = extensionPackage.iotModelUrl;
  }
  async getGraph() {
    // const graphFileFromRemote = await
    // this.blobService.getFile(this.graphUrl);
    const graphFilePath = this.context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName,
        DigitalTwinFileNames.devicemodelTemplateFolderName,
        DigitalTwinFileNames.graphFileName));
    const dtGraphfaceString = fs.readFileSync(graphFilePath, 'utf8');
    /*const dtGraphfaceString =
        graphFileFromRemote || fs.readFileSync(graphFilePath, 'utf8');
    if (graphFileFromRemote) {
      fs.writeFileSync(graphFilePath, graphFileFromRemote);
    }*/
    const dtGraph: DigitalTwinMetaModelGraph = JSON.parse(dtGraphfaceString);
    return dtGraph;
  }
  async getInterface() {
    // const interfaceFileFromRemote =
    //    await this.blobService.getFile(this.interfaceUrl);
    const interfaceFilePath = this.context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName,
        DigitalTwinFileNames.devicemodelTemplateFolderName,
        DigitalTwinFileNames.interfaceFileName));
    const dtInterfaceString = fs.readFileSync(interfaceFilePath, 'utf8');
    /*const dtInterfaceString =
        interfaceFileFromRemote || fs.readFileSync(interfaceFilePath, 'utf8');
    if (interfaceFileFromRemote) {
      fs.writeFileSync(interfaceFilePath, interfaceFileFromRemote);
    }*/
    const dtInterface: DigitalTwinMetaModelContext =
        JSON.parse(dtInterfaceString);
    return dtInterface;
  }
  async getCapabilityModel() {
    // const capabilityModelFileFromRemote =
    //    await this.blobService.getFile(this.capabilityModelUrl);
    const capabilityModelFilePath = this.context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName,
        DigitalTwinFileNames.devicemodelTemplateFolderName,
        DigitalTwinFileNames.capabilityModelFileName));
    const dtCapabilityModelString =
        fs.readFileSync(capabilityModelFilePath, 'utf8');
    /*const dtCapabilityModelString = capabilityModelFileFromRemote ||
        fs.readFileSync(capabilityModelFilePath, 'utf8');
    if (capabilityModelFileFromRemote) {
      fs.writeFileSync(capabilityModelFilePath, capabilityModelFileFromRemote);
    }*/
    const dtCapabilityModel: DigitalTwinMetaModelContext =
        JSON.parse(dtCapabilityModelString);
    return dtCapabilityModel;
  }
  async getIoTModel() {
    // const iotModelFileFromRemote =
    //    await this.blobService.getFile(this.iotModelUrl);
    const iotModelFilePath = this.context.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, FileNames.templatesFolderName,
        DigitalTwinFileNames.devicemodelTemplateFolderName,
        DigitalTwinFileNames.iotModelFileName));
    const dtIoTModelString = fs.readFileSync(iotModelFilePath, 'utf8');
    /*const dtIoTModelString =
        iotModelFileFromRemote || fs.readFileSync(iotModelFilePath, 'utf8');
    if (iotModelFileFromRemote) {
      fs.writeFileSync(iotModelFilePath, iotModelFileFromRemote);
    }*/
    const dtCapabilityModel: DigitalTwinMetaModelContext =
        JSON.parse(dtIoTModelString);
    return dtCapabilityModel;
  }
}
