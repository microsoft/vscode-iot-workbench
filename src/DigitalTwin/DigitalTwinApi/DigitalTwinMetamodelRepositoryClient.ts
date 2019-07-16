// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';
import * as request from 'request-promise';
import {SearchResults} from './DataContracts/SearchResults';
import {MetaModelType, SearchOptions, MetaModelUpsertRequest} from './DataContracts/DigitalTwinContext';
import {DigitalTwinConnectionStringBuilder} from './DigitalTwinConnectionStringBuilder';
import {DigitalTwinSharedAccessKey} from './DigitalTwinSharedAccessKey';
import {ConfigKey} from '../../constants';
import {GetModelResult} from './DataContracts/DigitalTwinModel';
import {ConfigHandler} from '../../configHandler';
import {DigitalTwinConstants} from '../DigitalTwinConstants';

const constants = {
  mediaType: 'application/json',
  apiModel: '/models',
  modelSearch: '/models/search'
};


export class DigitalTwinMetamodelRepositoryClient {
  private dtSharedAccessKey: DigitalTwinSharedAccessKey|null;
  private metaModelRepositoryHostName: vscode.Uri;

  constructor(connectionString: string|null) {
    if (!connectionString) {  // Connect to public repo
      this.dtSharedAccessKey = null;
      const storedConnectionString =
          ConfigHandler.get<string>(ConfigKey.modelRepositoryKeyName);
      if (storedConnectionString) {
        const builder =
            DigitalTwinConnectionStringBuilder.Create(storedConnectionString);
        this.metaModelRepositoryHostName = vscode.Uri.parse(builder.HostName);
      } else {
        const dtRepositoryUrl =
            ConfigHandler.get<string>(ConfigKey.iotPnPRepositoryUrl);
        if (!dtRepositoryUrl) {
          throw new Error(
              'The default IoT Plug and Play Model Repository URL is not provided. Please set IoTPnPRepositoryUrl in configuration.');
        }
        this.metaModelRepositoryHostName = vscode.Uri.parse(dtRepositoryUrl);
      }
    } else {
      const builder =
          DigitalTwinConnectionStringBuilder.Create(connectionString);
      this.metaModelRepositoryHostName = vscode.Uri.parse(builder.HostName);
      this.dtSharedAccessKey = new DigitalTwinSharedAccessKey(builder);
    }
  }

  async GetInterfaceAsync(
      modelId: string, repositoryId?: string,
      expand = false): Promise<GetModelResult> {
    if (repositoryId && !this.dtSharedAccessKey) {
      throw new Error(
          'The repository connection string is required to get the interface.');
    }

    return await this.MakeGetModelRequestAsync(
        MetaModelType.Interface, modelId, repositoryId, expand);
  }

  async GetCapabilityModelAsync(
      modelId: string, repositoryId?: string,
      expand = false): Promise<GetModelResult> {
    if (repositoryId && !this.dtSharedAccessKey) {
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

    if (repositoryId && !this.dtSharedAccessKey) {
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

    if (repositoryId && !this.dtSharedAccessKey) {
      throw new Error(
          'The connection string is required to search capability models in organizational model repository.');
    }

    return await this.MakeSearchRequestAsync(
        MetaModelType.CapabilityModel, searchString, continuationToken,
        repositoryId, pageSize);
  }


  async CreateOrUpdateInterfaceAsync(
      content: string, modelId: string, etag?: string,
      repositoryId?: string): Promise<string> {
    if (repositoryId && !this.dtSharedAccessKey) {
      throw new Error(
          'The connection string is required to publish interface in organizational model repository.');
    }

    return await this.MakeCreateOrUpdateRequestAsync(
        MetaModelType.Interface, content, modelId, etag, repositoryId);
  }

  /// <summary>
  /// Updates the capability model with the new context content.
  /// </summary>
  async CreateOrUpdateCapabilityModelAsync(
      content: string, modelId: string, etag?: string, repositoryId?: string) {
    if (repositoryId && !this.dtSharedAccessKey) {
      throw new Error(
          'The connection string is required to publish capability model in organizational model repository.');
    }

    return await this.MakeCreateOrUpdateRequestAsync(
        MetaModelType.CapabilityModel, content, modelId, etag, repositoryId);
  }

  /// <summary>
  /// Deletes an interface for given modelId.
  /// </summary>
  async DeleteInterfaceAsync(modelId: string, repositoryId: string) {
    if (!repositoryId) {
      throw new Error(
          'The repository id is required to delete capability model. Delete interface is not allowed for public repository.');
    }

    if (repositoryId && !this.dtSharedAccessKey) {
      throw new Error(
          'The connection string is required to delete interface in organizational model repository.');
    }

    await this.MakeDeleteRequestAsync(
        MetaModelType.Interface, modelId, repositoryId);
  }

  /// <summary>
  /// Deletes a capability model for given model id.
  /// </summary>
  async DeleteCapabilityModelAsync(modelId: string, repositoryId: string) {
    if (!repositoryId) {
      throw new Error(
          'The repository id is required to delete capability model. Delete capability model is not allowed for public repository.');
    }

    if (!this.dtSharedAccessKey) {
      throw new Error(
          'The connection string is required to delete capability model in organizational model repository.');
    }

    await this.MakeDeleteRequestAsync(
        MetaModelType.CapabilityModel, modelId, repositoryId);
  }


  async MakeCreateOrUpdateRequestAsync(
      metaModelType: MetaModelType, contents: string, modelId: string,
      etag?: string, repositoryId?: string,
      apiVersion = DigitalTwinConstants.apiVersion): Promise<string> {
    let targetUri = this.metaModelRepositoryHostName.toString();

    if (repositoryId) {
      targetUri +=
          `${constants.apiModel}/${encodeURIComponent(modelId)}?repositoryId=${
              repositoryId}&api-version=${apiVersion}`;
    } else {
      targetUri += `${constants.apiModel}/${
          encodeURIComponent(modelId)}?api-version=${apiVersion}`;
    }

    let authenticationString = '';

    if (this.dtSharedAccessKey) {
      authenticationString = this.dtSharedAccessKey.GenerateSASToken();
    }

    const payload = JSON.parse(contents);

    const options: request.OptionsWithUri = {
      method: 'PUT',
      uri: targetUri,
      encoding: 'utf8',
      json: true,
      headers: {
        Authorization: authenticationString,
        'Content-Type': 'application/json'
      },
      resolveWithFullResponse: true,
      body: payload
    };

    return new Promise<string>((resolve, reject) => {
      request(options)
          .then(response => {
            return resolve(response.headers['etag']);
          })
          .catch(err => {
            reject(err);
          });
    });
  }

  private async MakeGetModelRequestAsync(
      metaModelType: MetaModelType, modelId: string, repositoryId?: string,
      expand = false,
      apiVersion = DigitalTwinConstants.apiVersion): Promise<GetModelResult> {
    const targetUri =
        this.GenerateFetchModelUri(modelId, apiVersion, repositoryId, expand);

    let authenticationString = '';

    if (this.dtSharedAccessKey) {
      authenticationString = this.dtSharedAccessKey.GenerateSASToken();
    }

    const options: request.OptionsWithUri = {
      method: 'GET',
      uri: targetUri,
      encoding: 'utf8',
      json: true,
      headers: {Authorization: authenticationString},
      resolveWithFullResponse: true
    };

    return new Promise<GetModelResult>((resolve, reject) => {
      request(options)
          .then(response => {
            const result: GetModelResult = {
              content: response.body,
              etag: response.headers['etag'],
              urnId: response.headers['x-ms-model-id']
            };
            return resolve(result);
          })
          .catch(err => {
            reject(err);
          });
    });
  }

  private async MakeSearchRequestAsync(
      metaModelType: MetaModelType, searchString: string,
      continuationToken: string|null, repositoryId?: string, pageSize = 20,
      apiVersion = DigitalTwinConstants.apiVersion): Promise<SearchResults> {
    const payload: SearchOptions = {
      searchKeyword: searchString,
      modelFilterType: metaModelType,
      continuationToken,
      pageSize
    };

    let queryString = this.metaModelRepositoryHostName.toString();

    if (repositoryId) {
      queryString += `${constants.modelSearch}?repositoryId=${
          repositoryId}&api-version=${apiVersion}`;
    } else {
      queryString += `${constants.modelSearch}?api-version=${apiVersion}`;
    }

    let authenticationString = '';

    if (this.dtSharedAccessKey) {
      authenticationString = this.dtSharedAccessKey.GenerateSASToken();
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
      metaModelType: MetaModelType, modelId: string, repositoryId?: string,
      apiVersion = DigitalTwinConstants.apiVersion) {
    const queryString = `?repositoryId=${repositoryId}`;
    const resourceUrl =
        `${this.metaModelRepositoryHostName.toString()}${constants.apiModel}/${
            encodeURIComponent(
                modelId)}${queryString}&api-version=${apiVersion}`;

    let authenticationString = '';

    if (this.dtSharedAccessKey) {
      authenticationString = this.dtSharedAccessKey.GenerateSASToken();
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
      modelId: string, apiVersion: string, repositoryId?: string,
      expand = false) {
    let result =
        `${this.metaModelRepositoryHostName.toString()}${constants.apiModel}/${
            encodeURIComponent(modelId)}?api-version=${apiVersion}`;
    const expandString = expand ? `&expand=true` : '';
    if (repositoryId) {
      result += `${expandString}&repositoryId=${repositoryId}`;
    } else {
      result += `${expandString}`;
    }
    return result;
  }
}