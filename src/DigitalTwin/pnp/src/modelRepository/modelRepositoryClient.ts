// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as request from "request-promise";
import { Constants } from "../common/constants";
import { ModelType } from "../deviceModel/deviceModelManager";
import { GetResult, MetaModelType, SearchOptions, SearchResult } from "./modelRepositoryInterface";
import { RepositoryInfo } from "./modelRepositoryManager";

/**
 * Http method type
 */
enum HttpMethod {
  Get = "GET",
  Post = "POST",
  Put = "PUT",
  Delete = "DELETE"
}

/**
 * DigitalTwin model repository client
 */
export class ModelRepositoryClient {
  /**
   * get model from repository
   * @param repoInfo repository info
   * @param modelId model id
   * @param expand identify if expand result
   */
  static async getModel(repoInfo: RepositoryInfo, modelId: string, expand = false): Promise<GetResult> {
    const options: request.OptionsWithUri = ModelRepositoryClient.createOptions(HttpMethod.Get, repoInfo, modelId);
    if (expand) {
      options.qs.expand = "true";
    }
    return new Promise<GetResult>((resolve, reject) => {
      request(options)
        .then(response => {
          const result: GetResult = {
            etag: response.headers[ModelRepositoryClient.ETAG_HEADER],
            modelId: response.headers["x-ms-model-id"],
            content: response.body
          };
          return resolve(result);
        })
        .catch(err => {
          reject(err);
        });
    });
  }

  /**
   * search model from repository
   * @param repoInfo repository info
   * @param type model type
   * @param keyword keyword
   * @param pageSize page size
   * @param continuationToken continuation token
   */
  static async searchModel(
    repoInfo: RepositoryInfo,
    type: ModelType,
    keyword: string,
    pageSize: number,
    continuationToken: string | null
  ): Promise<SearchResult> {
    const options: request.OptionsWithUri = ModelRepositoryClient.createOptions(HttpMethod.Post, repoInfo);
    const modelFilterType: MetaModelType = ModelRepositoryClient.convertToMetaModelType(type);
    const payload: SearchOptions = {
      searchKeyword: keyword,
      modelFilterType,
      continuationToken,
      pageSize
    };
    options.body = payload;
    return new Promise<SearchResult>((resolve, reject) => {
      request(options)
        .then(response => {
          const result = response.body as SearchResult;
          return resolve(result);
        })
        .catch(err => {
          reject(err);
        });
    });
  }

  /**
   * update model in repository
   * @param repoInfo repository info
   * @param modelId model id
   * @param content content to update
   */
  static async updateModel(
    repoInfo: RepositoryInfo,
    modelId: string,
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    content: any
  ): Promise<string> {
    const options: request.OptionsWithUri = ModelRepositoryClient.createOptions(HttpMethod.Put, repoInfo, modelId);
    options.body = content;
    return new Promise<string>((resolve, reject) => {
      request(options)
        .then(response => {
          const result: string = response.headers[ModelRepositoryClient.ETAG_HEADER];
          return resolve(result);
        })
        .catch(err => {
          reject(err);
        });
    });
  }

  /**
   * delete model from repository
   * @param repoInfo repository info
   * @param modelId model id
   */
  static async deleteModel(repoInfo: RepositoryInfo, modelId: string): Promise<void> {
    const options: request.OptionsWithUri = ModelRepositoryClient.createOptions(HttpMethod.Delete, repoInfo, modelId);
    return new Promise<void>((resolve, reject) => {
      request(options)
        .then(() => {
          resolve();
        })
        .catch(err => {
          reject(err);
        });
    });
  }

  private static readonly ETAG_HEADER = "etag";

  /**
   * convert to meta model type
   * @param type model type
   */
  private static convertToMetaModelType(type: ModelType): MetaModelType {
    switch (type) {
      case ModelType.Interface:
        return MetaModelType.Interface;
      case ModelType.CapabilityModel:
        return MetaModelType.CapabilityModel;
      default:
        return MetaModelType.None;
    }
  }

  /**
   * create http request options
   * @param method http method
   * @param repoInfo repository info
   * @param modelId model id
   */
  private static createOptions(method: HttpMethod, repoInfo: RepositoryInfo, modelId?: string): request.OptionsWithUri {
    const uri = modelId
      ? `${repoInfo.hostname}/models/${encodeURIComponent(modelId)}`
      : `${repoInfo.hostname}/models/search`;
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    const qs: any = { "api-version": repoInfo.apiVersion };
    if (repoInfo.repositoryId) {
      qs.repositoryId = repoInfo.repositoryId;
    }
    const accessToken = repoInfo.accessToken || Constants.EMPTY_STRING;
    const options: request.OptionsWithUri = {
      method,
      uri,
      qs,
      encoding: Constants.UTF8,
      json: true,
      headers: {
        Authorization: accessToken,
        "Content-Type": "application/json"
      },
      resolveWithFullResponse: true
    };
    return options;
  }

  private constructor() {}
}
