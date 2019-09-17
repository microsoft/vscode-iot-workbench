// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export enum MetaModelType {
  None = 'none',
  Interface = 'interface',
  CapabilityModel = 'capabilityModel',
}

export const humanReadableMetaModelType = new Map<MetaModelType, string>([
  [MetaModelType.None, 'None'],
  [MetaModelType.Interface, 'Interface'],
  [MetaModelType.CapabilityModel, 'Capability Model'],
]);

export interface MetaModelUpsertRequest {
  contents: string;
  etag?: string;
}

export interface SearchOptions {
  searchKeyword: string;
  modelFilterType: MetaModelType;
  continuationToken: string | null;
  pageSize?: number;
}
