// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export enum MetaModelType {
  Interface,
  Template
}

export interface PnPContext {
  resourceId?: string;
  content: string;
  published?: boolean;
  etag?: string;
  tags?: string[];
}