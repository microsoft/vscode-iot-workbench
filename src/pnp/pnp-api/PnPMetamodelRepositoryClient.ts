// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';
import * as request from 'request-promise';
import * as url from 'url';
import {SearchResults} from './DataContracts/SearchResults';
import {PnPUri} from './Validator/PnPUri';
import {MetaModelType, PnPContext} from './DataContracts/PnPContext';
import {PnPConnectionStringBuilder} from './PnPConnectionStringBuilder';
import {PnPConnectionString} from './PnPConnectionString';

const constants = {
  interfaceRoute: '/api/interfaces',
  capabilityModelRoute: '/api/capabilitymodels',
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

  async GetCapabilityModelByCapabilityModelIdAsync(pnpUri: PnPUri):
      Promise<PnPContext> {
    if (!pnpUri) {
      throw new Error('pnpUri is required to get the capability model.');
    }

    return await this.MakeGetRequestAsync(
        pnpUri.Id, MetaModelType.CapabilityModel, false);
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

  async GetCapabilityModelByResourceIdAsync(capabilityModelResourceId: string):
      Promise<PnPContext> {
    if (!capabilityModelResourceId) {
      throw new Error(
          'The name of the capability model ResourceId should not be null');
    }

    return await this.MakeGetRequestAsync(
        capabilityModelResourceId, MetaModelType.CapabilityModel, true);
  }


  async GetAllInterfacesAsync(continuationToken: string|null, pageSize = 20):
      Promise<SearchResults> {
    if (pageSize <= 0) {
      throw new Error('pageSize should be greater than 0');
    }

    return await this.MakeGetAllRequestAsync(
        MetaModelType.Interface, continuationToken, pageSize);
  }


  async GetAllCapabilityModelsAsync(
      continuationToken: string|null, pageSize = 20): Promise<SearchResults> {
    if (pageSize <= 0) {
      throw new Error('pageSize should be greater than 0');
    }

    return await this.MakeGetAllRequestAsync(
        MetaModelType.CapabilityModel, continuationToken, pageSize);
  }


  async UpdateInterface(pnpContext: PnPContext): Promise<PnPContext> {
    if (!pnpContext.resourceId) {
      throw new Error('pnpContext does not contain the resource id to update.');
    }

    // TODO:
    // const parsedResult = PnPParser.ParsePnPInterface(pnpContext.content);
    return await this.MakeCreateOrUpdateRequestAsync(
        pnpContext, 'PUT', MetaModelType.Interface);
  }

  /// <summary>
  /// Updates the capability model with the new context content.
  /// </summary>
  /// <param name="pnpContext"><see cref="PnPContext"/> object.</param>
  /// <returns><see cref="PnPContext"/> object.</returns>
  async UpdateCapabilityModelAsync(pnpContext: PnPContext):
      Promise<PnPContext> {
    if (!pnpContext.resourceId) {
      throw new Error('pnpContext does not contain the resource id to update.');
    }

    // TODO:
    // ParseTemplateResult parsedResult =
    // PnPParser.ParsePnpTemplate(pnpContext.Content);
    return await this.MakeCreateOrUpdateRequestAsync(
        pnpContext, 'PUT', MetaModelType.CapabilityModel);
  }

  /// <summary>
  /// Creates an interface with the give pnpContext.
  /// </summary>
  /// <param name="pnpContext"><see cref="PnPContext"/> object.</param>
  /// <returns>Created <see cref="PnPContext"/> object.</returns>
  async CreateInterfaceAsync(pnpContext: PnPContext): Promise<PnPContext> {
    if (!pnpContext.content) {
      throw new Error('pnpContext content is null or empty.');
    }

    // TODO:
    // ParseInterfaceResult parsedResult =
    // PnPParser.ParsePnPInterface(pnpContext.Content);
    return await this.MakeCreateOrUpdateRequestAsync(
        pnpContext, 'POST', MetaModelType.Interface);
  }

  /// <summary>
  /// Creates an interface with the give pnpContext.
  /// </summary>
  /// <param name="pnpContext"><see cref="PnPContext"/> object.</param>
  /// <returns>Created <see cref="PnPContext"/> object.</returns>
  async CreateCapabilityModelAsync(pnpContext: PnPContext):
      Promise<PnPContext> {
    if (!pnpContext.content) {
      throw new Error(
          'pnpContext content is required to create capability model.');
    }

    // TODO:
    // ParseTemplateResult parsedResult =
    // PnPParser.ParsePnpTemplate(pnpContext.Content)
    return await this.MakeCreateOrUpdateRequestAsync(
        pnpContext, 'POST', MetaModelType.CapabilityModel);
  }


  /// <summary>
  /// Deletes an interface for given resource id.
  /// </summary>
  /// <param name="resourceId"><see cref="resourceId"/> object.</param>
  async DeleteInterfaceByResourceIdAsync(resourceId: string) {
    if (!resourceId) {
      throw new Error('resourceId is required to delete the interface.');
    }

    await this.MakeDeleteRequestAsync(
        resourceId, MetaModelType.Interface, true);
  }

  /// <summary>
  /// Deletes an interface for given PnPUri.
  /// </summary>
  /// <param name="pnpInterfaceUri"><see cref="PnPUri"/> object.</param>
  async DeleteInterfaceByInterfaceIdAsync(pnpInterfaceUri: PnPUri) {
    if (!pnpInterfaceUri) {
      throw new Error('pnpInterfaceUri is required to delete the interface.');
    }

    await this.MakeDeleteRequestAsync(
        pnpInterfaceUri.Id, MetaModelType.Interface);
  }

  /// <summary>
  /// Deletes a capability model for given resource id.
  /// </summary>
  /// <param name="resourceId"><see cref="resourceId"/> object.</param>
  async DeleteCapabilityModelByResourceIdAsync(resourceId: string) {
    if (!resourceId) {
      throw new Error('resourceId is required to delete the capability model.');
    }

    await this.MakeDeleteRequestAsync(
        resourceId, MetaModelType.CapabilityModel, true);
  }

  /// <summary>
  /// Deletes a capability model for given PnPUri.
  /// </summary>
  /// <param name="pnpCapabilityModelUri"><see cref="PnPUri"/> object.</param>
  async DeleteCapabilityModelByCapabilityModelIdAsync(pnpCapabilityModelUri:
                                                          PnPUri) {
    if (!pnpCapabilityModelUri) {
      throw new Error(
          'pnpCapabilityModelUri is required to delete the capability model.');
    }

    await this.MakeDeleteRequestAsync(
        pnpCapabilityModelUri.Id, MetaModelType.CapabilityModel);
  }


  /// <summary>
  /// Publishes an interface.
  /// </summary>
  /// <param name="pnpUri">PnPUri of an interface.</param>
  async PublishInterfaceAsync(pnpUri: PnPUri) {
    if (!pnpUri) {
      throw new Error('PnPUri is required to publish the interface.');
    }

    await this.MakePatchRequestAsync(pnpUri, MetaModelType.Interface);
  }

  /// <summary>
  /// Publishes capability model.
  /// </summary>
  /// <param name="pnpUri">PnPUri of capability model.</param>
  async PublishCapabilityModelAsync(pnpUri: PnPUri) {
    if (!pnpUri) {
      throw new Error('PnPUri is required to publish the capability model.');
    }

    await this.MakePatchRequestAsync(pnpUri, MetaModelType.CapabilityModel);
  }


  async MakeCreateOrUpdateRequestAsync(
      pnpContext: PnPContext, httpMethod: string,
      metaModelType: MetaModelType): Promise<PnPContext> {
    let options: request.OptionsWithUri;
    let targetUri: string;

    if (httpMethod === 'POST') {
      targetUri = this.GetRepositoryEndPoint(metaModelType);
      options = {
        method: httpMethod,
        uri: targetUri,
        json: true,
        headers: {
          Authorization: this.pnpConnectionString.GetAuthorizationHeader(),
          'Content-Type': 'application/json'
        },
        body: pnpContext
      };
    } else if (httpMethod === 'PUT') {
      targetUri = this.GetRepositoryEndPoint(
          metaModelType, pnpContext.resourceId, null, true);
      options = {
        method: httpMethod,
        uri: targetUri,
        encoding: 'utf8',
        json: true,
        headers: {
          Authorization: this.pnpConnectionString.GetAuthorizationHeader(),
          'Content-Type': 'application/json'
        },
        body: pnpContext
      };
    } else {
      throw new Error('');
    }

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

  private async MakeGetRequestAsync(
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

  private async MakeGetAllRequestAsync(
      metaModelType: MetaModelType, continuationToken: string|null,
      pageSize: number): Promise<SearchResults> {
    const relativeUri = metaModelType === MetaModelType.Interface ?
        constants.interfaceRoute :
        constants.capabilityModelRoute;
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

  private async MakePatchRequestAsync(
      pnpUri: PnPUri, metaModelType: MetaModelType) {
    const targetUri =
        this.GetRepositoryEndPoint(metaModelType, pnpUri.Id, 'publish');

    const options = {
      method: 'PATCH',
      uri: targetUri,
      headers:
          {Authorization: this.pnpConnectionString.GetAuthorizationHeader()},
      resolveWithFullResponse: true
    };
    return new Promise<void>((resolve, reject) => {
      request(options)
          .then(response => {
            return resolve();
          })
          .catch(err => {
            reject(err);
          });
    });
  }

  /// <summary>
  /// Helper method to make a Delete Request to PnP Metamodal repository
  /// service.
  /// </summary>
  /// <param name="metaModelId">Metamodel id.</param>
  /// <param name="metaModelType"><see cref="MetaModelType"/> Interface or capability model.</param>
  private async MakeDeleteRequestAsync(
      metaModelId: string, metaModelType: MetaModelType, isResourceId = false) {
    const targetUri = this.GetRepositoryEndPoint(
        metaModelType, metaModelId, null, isResourceId);

    const options = {
      method: 'DELETE',
      uri: targetUri,
      headers: {
        Authorization: this.pnpConnectionString.GetAuthorizationHeader(),
        'Content-Type': 'application/json'
      },
      resolveWithFullResponse: true
    };
    return new Promise<void>((resolve, reject) => {
      request(options)
          .then(response => {
            console.log('Delete succeed with status %d', response.statusCode);
            return resolve();
          })
          .catch(err => {
            reject(err);
          });
    });
  }


  private GetRepositoryEndPoint(
      metaModelType: MetaModelType, metaModelId = '',
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
          constants.capabilityModelRoute :
          constants.capabilityModelRoute + `/${relativeRoute}`;
      if (isResourceId) {
        relativeRoute += `/${metaModelId}`;
      } else {
        relativeRoute += `?capabilityModelId=${metaModelId}`;
      }
    }
    return url.resolve(
        this.metaModelRepositoryHostName.toString(), relativeRoute);
  }
}