// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';
import * as request from 'request-promise';
import * as url from 'url';
import {SearchResults} from './DataContracts/SearchResults';
import {PnPUri} from './Validator/PnPUri';
import {PnPContext} from './DataContracts/PnPContext';
import {PnPConnectionStringBuilder} from './PnPConnectionStringBuilder';
import {PnPConnectionString} from './PnPConnectionString';


export enum MetaModelType {
  Interface,
  Template
}

const constants = {
  interfaceRoute: '/api/interfaces',
  templateRoute: '/api/templates',
  mediaType: 'application/json'
};


export class PnPMetamodelRepositoryClient {
  private pnpConnectionString: PnPConnectionString;
  private metaModelRepositoryHostName: vscode.Uri;

  constructor(connectionString: string) {
    if (!connectionString) {
      throw new Error('The input connection string is empty');
    }
    this.pnpConnectionString = new PnPConnectionString(
        PnPConnectionStringBuilder.Create(connectionString));
    this.metaModelRepositoryHostName = this.pnpConnectionString.HttpEndpoint;
  }

  async GetInterfaceByInterfaceIdAsync(pnpUri: PnPUri): Promise<PnPContext> {
    if (!pnpUri) {
      throw new Error('pnpUri is required to get the interface.');
    }

    return await this.MakeGetRequestAsync(
        pnpUri.Id, MetaModelType.Interface, false);
  }

  async GetTemplateByTemplateIdAsync(pnpUri: PnPUri): Promise<PnPContext> {
    if (!pnpUri) {
      throw new Error('pnpUri is required to get the template.');
    }

    return await this.MakeGetRequestAsync(
        pnpUri.Id, MetaModelType.Template, false);
  }

  async GetInterfaceByResourceIdAsync(interfaceResourceId: string):
      Promise<PnPContext> {
    if (!interfaceResourceId) {
      throw new Error(
          'The name of the interface ResourceId should not be null');
    }

    return await this.MakeGetRequestAsync(
        interfaceResourceId, MetaModelType.Interface, true);
  }

  async GetTemplateByResourceIdAsync(templateResourceId: string):
      Promise<PnPContext> {
    if (!templateResourceId) {
      throw new Error('The name of the template ResourceId should not be null');
    }

    return await this.MakeGetRequestAsync(
        templateResourceId, MetaModelType.Template, true);
  }


  async GetAllInterfacesAsync(continuationToken: string|null, pageSize = 20):
      Promise<SearchResults> {
    if (pageSize <= 0) {
      throw new Error('pageSize should be greater than 0');
    }

    return await this.MakeGetAllRequestAsync(
        MetaModelType.Interface, continuationToken, pageSize);
  }


  async GetAllTemplatesAsync(continuationToken: string, pageSize = 20):
      Promise<SearchResults> {
    if (pageSize <= 0) {
      throw new Error('pageSize should be greater than 0');
    }

    return await this.MakeGetAllRequestAsync(
        MetaModelType.Template, continuationToken, pageSize);
  }


  async MakeGetRequestAsync(
      id: string, metaModelType: MetaModelType,
      isResourceId = false): Promise<PnPContext> {
    const targetUri =
        this.GetRepositoryEndPoint(metaModelType, id, null, isResourceId);
    const options: request.OptionsWithUri =
        {method: 'GET', uri: targetUri, encoding: 'utf8', json: true};

    return new Promise<PnPContext>((resolve, reject) => {
      request(options)
          .then(response => {
            const result: PnPContext = response as PnPContext;
            return resolve(result);
          })
          .catch(err => {
            reject(err);
          });
    });
  }

  async MakeGetAllRequestAsync(
      metaModelType: MetaModelType, continuationToken: string|null,
      pageSize: number): Promise<SearchResults> {
    const relativeUri = metaModelType === MetaModelType.Interface ?
        constants.interfaceRoute :
        constants.templateRoute;
    let uriString = `${relativeUri}?pageSize=${pageSize}`;
    if (continuationToken) {
      uriString +=
          `&continuationToken=${encodeURIComponent(continuationToken)}`;
    }

    const uri =
        url.resolve(this.metaModelRepositoryHostName.toString(), uriString);
    const options: request
        .OptionsWithUri = {method: 'GET', uri, encoding: 'utf8', json: true};

    return new Promise<SearchResults>((resolve, reject) => {
      request(options)
          .then(response => {
            const result: SearchResults = response as SearchResults;
            return resolve(result);
          })
          .catch(err => {
            reject(err);
          });
    });
  }

  GetRepositoryEndPoint(
      metaModelType: MetaModelType, metaModelId: string|null = null,
      relativeRoute: string|null = null, isResourceId = false): string {
    if (metaModelType === MetaModelType.Interface) {
      relativeRoute = relativeRoute === null ?
          constants.interfaceRoute :
          constants.interfaceRoute + `/${relativeRoute}`;
      if (isResourceId) {
        relativeRoute += `/${metaModelId}`;
      } else {
        relativeRoute += `?interfaceId=${metaModelId}`;
      }
    } else {
      relativeRoute = relativeRoute === null ?
          constants.templateRoute :
          constants.templateRoute + `/${relativeRoute}`;
      if (isResourceId) {
        relativeRoute += `/${metaModelId}`;
      } else {
        relativeRoute += `?templateId=${metaModelId}`;
      }
    }
    return url.resolve(
        this.metaModelRepositoryHostName.toString(), relativeRoute);
  }
}