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
  searchString: string;
  pnpModelType: MetaModelType;
  continuationToken: string|null;
  pageSize?: number;
}

export interface DownloadContentParameters {
  fileName: string;
  content: string;
}

/*export interface PnPContext {
  resourceId?: string;
  content: string;
  published?: boolean;
  etag?: string;
  tags?: string[];
}*/