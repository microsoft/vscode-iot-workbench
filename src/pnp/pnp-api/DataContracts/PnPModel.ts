// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export interface PnPModelBase {
  contents?: string;
  comment?: string;
  description?: string;
  displayName?: LocalizedData[];
  id: string;
  modelName: string;
  version: string;
  pnpMetamodelType: string;
  etag: string;
  tenantId: string;
  tenantName: string;
  createdOn: string;
  lastUpdated: string;
}

export interface PnPModel extends PnPModelBase { contents: string; }

export interface LocalizedData {
  locale: string;
  value: string;
}