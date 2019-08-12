// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as request from 'request-promise';
import {SearchResults} from './DataContracts/SearchResults';
import {MetaModelType, SearchOptions} from './DataContracts/DigitalTwinContext';
import {DigitalTwinConnectionStringBuilder} from './DigitalTwinConnectionStringBuilder';
import {DigitalTwinSharedAccessKey} from './DigitalTwinSharedAccessKey';
import {ConfigKey} from '../../constants';
import {GetModelResult} from './DataContracts/DigitalTwinModel';
import {ConfigHandler} from '../../configHandler';
import {DigitalTwinConstants} from '../DigitalTwinConstants';
import * as url from 'url';

const constants = {
  mediaType: 'application/json',
  apiModel: '/models',
  modelSearch: '/models/search'
};

export class DigitalTwinMetamodelRepositoryClient {
  private modelRepoSharedAccessKey: DigitalTwinSharedAccessKey|null = null;
  private modelPublicRepoUrl?: string;

  constructor() {}

  async initialize(connectionString: string|null) {
    let modelRepoUrl = null;
    if (!connectionString) {
      // Connect to public repo
      this.modelRepoSharedAccessKey = null;
      const dtRepositoryUrl =
          ConfigHandler.get<string>(ConfigKey.iotPnPPublicRepositoryUrl);
      if (!dtRepositoryUrl) {
        throw new Error(
            'The IoT Plug and Play public repository URL is invalid.');
      }
      modelRepoUrl = dtRepositoryUrl;
    } else {
      const builder =
          DigitalTwinConnectionStringBuilder.create(connectionString);
      if (!builder.hostName.startsWith('http')) {
        // The hostname from connections string doesn't contain the protocol
        modelRepoUrl = 'https://' + builder.hostName;
      } else {
        modelRepoUrl = builder.hostName;
      }
      this.modelRepoSharedAccessKey = new DigitalTwinSharedAccessKey(builder);
    }
    const repoUrl = url.parse(modelRepoUrl);
    repoUrl.protocol = 'https';  // force to https
    this.modelPublicRepoUrl = repoUrl.href;
  }

  async getInterfaceAsync(
      modelId: string, repositoryId?: string,
      expand = false): Promise<GetModelResult> {
    if (repositoryId && !this.modelRepoSharedAccessKey) {
      throw new Error(
          'The repository connection string is required to get the Interface.');
    }

    return await this.makeGetModelRequestAsync(
        MetaModelType.Interface, modelId, repositoryId, expand);
  }

  async getCapabilityModelAsync(
      modelId: string, repositoryId?: string,
      expand = false): Promise<GetModelResult> {
    if (repositoryId && !this.modelRepoSharedAccessKey) {
      throw new Error(
          'The repository connection string is required to get the Capability Model.');
    }

    return await this.makeGetModelRequestAsync(
        MetaModelType.CapabilityModel, modelId, repositoryId, expand);
  }

  async searchInterfacesAsync(
      searchString: string, continuationToken: string|null,
      repositoryId?: string, pageSize = 20): Promise<SearchResults> {
    if (pageSize <= 0) {
      throw new Error('pageSize should be greater than 0');
    }

    if (repositoryId && !this.modelRepoSharedAccessKey) {
      throw new Error(
          'The connection string is required to search intefaces in company repository.');
    }

    return await this.makeSearchRequestAsync(
        MetaModelType.Interface, searchString, continuationToken, repositoryId,
        pageSize);
  }

  async searchCapabilityModelsAsync(
      searchString: string, continuationToken: string|null,
      repositoryId?: string, pageSize = 20): Promise<SearchResults> {
    if (pageSize <= 0) {
      throw new Error('pageSize should be greater than 0');
    }

    if (repositoryId && !this.modelRepoSharedAccessKey) {
      throw new Error(
          'The connection string is required to search Capability Models in company repository.');
    }

    return await this.makeSearchRequestAsync(
        MetaModelType.CapabilityModel, searchString, continuationToken,
        repositoryId, pageSize);
  }

  async createOrUpdateInterfaceAsync(
      content: string, modelId: string, etag?: string,
      repositoryId?: string): Promise<string> {
    if (repositoryId && !this.modelRepoSharedAccessKey) {
      throw new Error(
          'The connection string is required to publish Interface in company repository.');
    }

    return await this.makeCreateOrUpdateRequestAsync(
        MetaModelType.Interface, content, modelId, etag, repositoryId);
  }

  /// <summary>
  /// Updates the Capability Model with the new context content.
  /// </summary>
  async createOrUpdateCapabilityModelAsync(
      content: string, modelId: string, etag?: string, repositoryId?: string) {
    if (repositoryId && !this.modelRepoSharedAccessKey) {
      throw new Error(
          'The connection string is required to publish Capability Model in company repository.');
    }

    return await this.makeCreateOrUpdateRequestAsync(
        MetaModelType.CapabilityModel, content, modelId, etag, repositoryId);
  }

  /// <summary>
  /// Deletes an Interface for given modelId.
  /// </summary>
  async deleteInterfaceAsync(modelId: string, repositoryId: string) {
    if (!repositoryId) {
      throw new Error(
          'The repository id is required to delete Capability Model. Delete Interface is not allowed for public repository.');
    }

    if (repositoryId && !this.modelRepoSharedAccessKey) {
      throw new Error(
          'The connection string is required to delete Interface in company repository.');
    }

    await this.makeDeleteRequestAsync(
        MetaModelType.Interface, modelId, repositoryId);
  }

  /// <summary>
  /// Deletes a Capability Model for given model id.
  /// </summary>
  async deleteCapabilityModelAsync(modelId: string, repositoryId: string) {
    if (!repositoryId) {
      throw new Error(
          'The repository id is required to delete Capability Model. Delete Capability Model is not allowed for public repository.');
    }

    if (!this.modelRepoSharedAccessKey) {
      throw new Error(
          'The connection string is required to delete Capability Model in company repository.');
    }

    await this.makeDeleteRequestAsync(
        MetaModelType.CapabilityModel, modelId, repositoryId);
  }

  async makeCreateOrUpdateRequestAsync(
      metaModelType: MetaModelType, contents: string, modelId: string,
      etag?: string, repositoryId?: string,
      apiVersion = DigitalTwinConstants.apiVersion): Promise<string> {
    if (!this.modelPublicRepoUrl) {
      throw new Error('The value of modelPublicRepoUrl is not initialized');
    }
    let targetUri = this.modelPublicRepoUrl;

    if (repositoryId) {
      targetUri +=
          `${constants.apiModel}/${encodeURIComponent(modelId)}?repositoryId=${
              repositoryId}&api-version=${apiVersion}`;
    } else {
      targetUri += `${constants.apiModel}/${
          encodeURIComponent(modelId)}?api-version=${apiVersion}`;
    }

    let authenticationString = '';

    if (this.modelRepoSharedAccessKey) {
      authenticationString = this.modelRepoSharedAccessKey.generateSASToken();
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

  private async makeGetModelRequestAsync(
      metaModelType: MetaModelType, modelId: string, repositoryId?: string,
      expand = false,
      apiVersion = DigitalTwinConstants.apiVersion): Promise<GetModelResult> {
    const targetUri =
        this.generateFetchModelUri(modelId, apiVersion, repositoryId, expand);

    let authenticationString = '';

    if (this.modelRepoSharedAccessKey) {
      authenticationString = this.modelRepoSharedAccessKey.generateSASToken();
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

  private async makeSearchRequestAsync(
      metaModelType: MetaModelType, searchString: string,
      continuationToken: string|null, repositoryId?: string, pageSize = 20,
      apiVersion = DigitalTwinConstants.apiVersion): Promise<SearchResults> {
    const payload: SearchOptions = {
      searchKeyword: searchString,
      modelFilterType: metaModelType,
      continuationToken,
      pageSize
    };
    if (!this.modelPublicRepoUrl) {
      throw new Error('The value of modelPublicRepoUrl is not initialized');
    }
    let queryString = this.modelPublicRepoUrl;

    if (repositoryId) {
      queryString += `${constants.modelSearch}?repositoryId=${
          repositoryId}&api-version=${apiVersion}`;
    } else {
      queryString += `${constants.modelSearch}?api-version=${apiVersion}`;
    }

    let authenticationString = '';

    if (this.modelRepoSharedAccessKey) {
      authenticationString = this.modelRepoSharedAccessKey.generateSASToken();
    }

    const options: request.OptionsWithUri = {
      method: 'POST',
      uri: queryString,
      encoding: 'utf8',
      json: true,
      headers: {
        Authorization: authenticationString,
        'Content-Type': 'application/json'
      },
      body: payload
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
  /// <param name="metaModelType"><see cref="MetaModelType"/> Interface or Capability Model.</param>
  private async makeDeleteRequestAsync(
      metaModelType: MetaModelType, modelId: string, repositoryId?: string,
      apiVersion = DigitalTwinConstants.apiVersion) {
    if (!this.modelPublicRepoUrl) {
      throw new Error('The value of modelPublicRepoUrl is not initialized');
    }
    const queryString = `?repositoryId=${repositoryId}`;
    const resourceUrl = `${this.modelPublicRepoUrl}${constants.apiModel}/${
        encodeURIComponent(modelId)}${queryString}&api-version=${apiVersion}`;

    let authenticationString = '';

    if (this.modelRepoSharedAccessKey) {
      authenticationString = this.modelRepoSharedAccessKey.generateSASToken();
    }

    const options = {
      method: 'DELETE',
      uri: resourceUrl,
      headers: {
        Accept: 'application/json',
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

  private generateFetchModelUri(
      modelId: string, apiVersion: string, repositoryId?: string,
      expand = false) {
    if (!this.modelPublicRepoUrl) {
      throw new Error('The value of modelPublicRepoUrl is not initialized');
    }
    let result = `${this.modelPublicRepoUrl}${constants.apiModel}/${
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
