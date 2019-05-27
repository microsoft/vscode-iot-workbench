// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export enum MetaModelType {
  None = 'none',
  Interface = 'interface',
  CapabilityModel = 'capabilityModel'
}

export interface MetaModelUpsertRequest {
  contents: string;
  etag?: string;
}

export interface SearchOptions {
  searchKeyword: string;
  modelFilterType: MetaModelType;
  continuationToken: string|null;
  pageSize?: number;
}
