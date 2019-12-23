// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

/**
 * Meta model type
 */
export enum MetaModelType {
  None = "none",
  Interface = "interface",
  CapabilityModel = "capabilityModel",
}

/**
 * Localized data
 */
export interface LocalizedData {
  locale: string;
  value: string;
}

/**
 * DigitalTwin base class
 */
export interface DigitalTwinModelBase {
  contents?: string;
  comment?: string;
  description?: string;
  displayName?: LocalizedData[];
  urnId: string;
  modelName: string;
  version: number;
  type: string;
  etag: string;
  publisherId: string;
  publisherName: string;
  createdOn: string;
  updatedOn: string;
}

/**
 * Search options
 */
export interface SearchOptions {
  searchKeyword: string;
  modelFilterType: MetaModelType;
  continuationToken: string | null;
  pageSize?: number;
}

/**
 * Result of search API
 */
export interface SearchResult {
  continuationToken?: string;
  results: DigitalTwinModelBase[];
}

/**
 * Result of get API
 */
export interface GetResult {
  etag: string;
  modelId: string;
  content: { [key: string]: string };
}
