// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export interface DigitalTwinModelBase {
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

export interface DigitalTwinModel extends DigitalTwinModelBase {
  contents: string;
}

export interface LocalizedData {
  locale: string;
  value: string;
}