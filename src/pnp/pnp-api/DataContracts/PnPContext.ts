// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export interface PnPContext {
  resourceId?: string;
  content: string;
  published?: boolean;
  etag?: string;
  tags?: string[];
}