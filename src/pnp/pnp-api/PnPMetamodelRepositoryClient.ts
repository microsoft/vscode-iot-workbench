// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';
import * as request from 'request-promise';
import {SearchResults} from './DataContracts/SearchResults';
import {MetaModelType, SearchOptions, MetaModelUpsertRequest} from './DataContracts/PnPContext';
import {PnPConnectionStringBuilder} from './PnPConnectionStringBuilder';
import {PnPSharedAccessKey} from './PnPSharedAccessKey';
import {GlobalConstants} from '../../constants';
import {MetaModelMetaData} from './DataContracts/MetaModelMetaData';

const constants = {
  mediaType: 'application/json',
  apiModel: '/Models',
  modelSearch: '/Models/Search'
};


export class PnPMetamodelRepositoryClient {
  private pnpSharedAccessKey: PnPSharedAccessKey|null;
  private metaModelRepositoryHostName: vscode.Uri;

  constructor(connectionString: string|null) {
    if (!connectionString) {
      this.pnpSharedAccessKey = null;
    } else {
      this.pnpSharedAccessKey = new PnPSharedAccessKey(
          PnPConnectionStringBuilder.Create(connectionString));
    }

    const extension =
        vscode.extensions.getExtension(GlobalConstants.extensionId);
    if (!extension) {
      throw new Error('Failed to load extension configuration file.');
    }
    this.metaModelRepositoryHostName =
        vscode.Uri.parse(extension.packageJSON.pnpRepositoryUrl);
  }

  async GetInterfaceAsync(
      modelId: string, repositoryId?: string,
      expand = false): Promise<MetaModelMetaData> {
    if (repositoryId && !this.pnpSharedAccessKey) {
      throw new Error(
          'The repository connection string is required to get the interface.');
    }

    return await this.MakeGetModelRequestAsync(
        MetaModelType.Interface, modelId, repositoryId, expand);
  }

  async GetCapabilityModelAsync(
      modelId: string, repositoryId?: string,
      expand = false): Promise<MetaModelMetaData> {
    if (repositoryId && !this.pnpSharedAccessKey) {
      throw new Error(
          'The repository connection string is required to get the capability model.');
    }

    return await this.MakeGetModelRequestAsync(
        MetaModelType.CapabilityModel, modelId, repositoryId, expand);
  }

  async SearchInterfacesAsync(
      searchString: string, continuationToken: string|null,
      repositoryId?: string, pageSize = 20): Promise<SearchResults> {
    if (pageSize <= 0) {
      throw new Error('pageSize should be greater than 0');
    }

    if (repositoryId && !this.pnpSharedAccessKey) {
      throw new Error(
          'The connection string is required to search intefaces in organizational model repository.');
    }

    return await this.MakeSearchRequestAsync(
        MetaModelType.Interface, searchString, continuationToken, repositoryId,
        pageSize);
  }


  async SearchCapabilityModelsAsync(
      searchString: string, continuationToken: string|null,
      repositoryId?: string, pageSize = 20): Promise<SearchResults> {
    if (pageSize <= 0) {
      throw new Error('pageSize should be greater than 0');
    }

    if (repositoryId && !this.pnpSharedAccessKey) {
      throw new Error(
          'The connection string is required to search capability models in organizational model repository.');
    }

    return await this.MakeSearchRequestAsync(
        MetaModelType.CapabilityModel, searchString, continuationToken,
        repositoryId, pageSize);
  }


  async CreateOrUpdateInterfaceAsync(
      content: string, etag?: string,
      repositoryId?: string): Promise<MetaModelMetaData> {
    if (repositoryId && !this.pnpSharedAccessKey) {
      throw new Error(
          'The connection string is required to publish interface in organizational model repository.');
    }

    // TODO:
    // const parsedResult = PnPParser.ParsePnPInterface(pnpContext.content);
    return await this.MakeCreateOrUpdateRequestAsync(
        MetaModelType.Interface, content, etag, repositoryId);
  }

  /// <summary>
  /// Updates the capability model with the new context content.
  /// </summary>
  /// <param name="pnpContext"><see cref="PnPContext"/> object.</param>
  /// <returns><see cref="PnPContext"/> object.</returns>
  async CreateOrUpdateCapabilityModelAsync(
      content: string, etag?: string,
      repositoryId?: string): Promise<MetaModelMetaData> {
    if (repositoryId && !this.pnpSharedAccessKey) {
      throw new Error(
          'The connection string is required to publish capability model in organizational model repository.');
    }

    return await this.MakeCreateOrUpdateRequestAsync(
        MetaModelType.CapabilityModel, content, etag, repositoryId);
  }

  /// <summary>
  /// Deletes an interface for given PnPUri.
  /// </summary>
  /// <param name="pnpInterfaceUri"><see cref="PnPUri"/> object.</param>
  async DeleteInterfaceAsync(modelId: string, repositoryId?: string) {
    if (repositoryId && !this.pnpSharedAccessKey) {
      throw new Error(
          'The connection string is required to delete interface in organizational model repository.');
    }

    await this.MakeDeleteRequestAsync(
        MetaModelType.Interface, modelId, repositoryId);
  }

  /// <summary>
  /// Deletes a capability model for given model id.
  /// </summary>
  /// <param name="pnpCapabilityModelUri"><see cref="PnPUri"/> object.</param>
  async DeleteCapabilityModelAsync(modelId: string, repositoryId?: string) {
    if (repositoryId && !this.pnpSharedAccessKey) {
      throw new Error(
          'The connection string is required to delete capability model in organizational model repository.');
    }

    await this.MakeDeleteRequestAsync(
        MetaModelType.CapabilityModel, modelId, repositoryId);
  }


  async MakeCreateOrUpdateRequestAsync(
      metaModelType: MetaModelType, contents: string, etag?: string,
      repositoryId?: string): Promise<MetaModelMetaData> {
    let targetUri = this.metaModelRepositoryHostName.toString();

    if (repositoryId) {
      targetUri += `${constants.apiModel}?repositoryId=${repositoryId}`;
    } else {
      targetUri += `${constants.apiModel}`;
    }

    let authenticationString = '';

    if (this.pnpSharedAccessKey) {
      authenticationString = this.pnpSharedAccessKey.GenerateSASToken();
    }

    const payload: MetaModelUpsertRequest = {etag, contents};

    const options: request.OptionsWithUri = {
      method: 'PUT',
      uri: targetUri,
      encoding: 'utf8',
      json: true,
      headers: {
        Authorization: authenticationString,
        'Content-Type': 'application/json'
      },
      body: payload
    };

    return new Promise<MetaModelMetaData>((resolve, reject) => {
      request(options)
          .then(response => {
            const result: MetaModelMetaData = response as MetaModelMetaData;
            return resolve(result);
          })
          .catch(err => {
            reject(err);
          });
    });
  }

  private async MakeGetModelRequestAsync(
      metaModelType: MetaModelType, modelId: string, repositoryId?: string,
      expand = false): Promise<MetaModelMetaData> {
    const targetUri = this.GenerateFetchModelUri(modelId, repositoryId, expand);

    let authenticationString = '';

    if (this.pnpSharedAccessKey) {
      authenticationString = this.pnpSharedAccessKey.GenerateSASToken();
    }

    const options: request.OptionsWithUri = {
      method: 'GET',
      uri: targetUri,
      encoding: 'utf8',
      json: true,
      headers: {Authorization: authenticationString},
    };

    return new Promise<MetaModelMetaData>((resolve, reject) => {
      request(options)
          .then(response => {
            const result: MetaModelMetaData = response as MetaModelMetaData;
            return resolve(result);
          })
          .catch(err => {
            reject(err);
          });
    });
  }

  private async MakeSearchRequestAsync(
      metaModelType: MetaModelType, searchString: string,
      continuationToken: string|null, repositoryId?: string,
      pageSize = 20): Promise<SearchResults> {
    const payload: SearchOptions = {
      searchString,
      pnpModelType: metaModelType,
      continuationToken,
      pageSize
    };

    let queryString = this.metaModelRepositoryHostName.toString();

    if (repositoryId) {
      queryString += `${constants.modelSearch}?repositoryId=${repositoryId}`;
    } else {
      queryString += `${constants.modelSearch}`;
    }

    let authenticationString = '';

    if (this.pnpSharedAccessKey) {
      authenticationString = this.pnpSharedAccessKey.GenerateSASToken();
    }

    const options: request.OptionsWithUri = {
      method: 'POST',
      uri: queryString,
      encoding: 'utf8',
      json: true,
      headers: {
        'Authorization': authenticationString,
        'Content-Type': 'application/json'
      },
      body: payload,
    };

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


  /// <summary>
  /// Helper method to make a Delete Request to PnP Metamodal repository
  /// service.
  /// </summary>
  /// <param name="metaModelId">Metamodel id.</param>
  /// <param name="metaModelType"><see cref="MetaModelType"/> Interface or capability model.</param>
  private async MakeDeleteRequestAsync(
      metaModelType: MetaModelType, modelId: string, repositoryId?: string) {
    const queryString = repositoryId ? `&repositoryId=${repositoryId}` : '';
    const resourceUrl = `${this.metaModelRepositoryHostName.toString()}${
        constants.apiModel}?modelId=${modelId}${queryString}`;

    let authenticationString = '';

    if (this.pnpSharedAccessKey) {
      authenticationString = this.pnpSharedAccessKey.GenerateSASToken();
    }

    const options = {
      method: 'DELETE',
      uri: resourceUrl,
      headers: {
        'Accept': 'application/json',
        Authorization: authenticationString,
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

  private GenerateFetchModelUri(
      modelId: string, repositoryId?: string, expand = false) {
    let result = `${this.metaModelRepositoryHostName.toString()}${
        constants.apiModel}?modelId=${encodeURIComponent(modelId)}`;
    const expandString = expand ? `&expand=true` : '';
    if (repositoryId) {
      result += `${expandString}&repositoryId=${repositoryId}`;
    } else {
      result += `${expandString}`;
    }
    return result;
  }
}