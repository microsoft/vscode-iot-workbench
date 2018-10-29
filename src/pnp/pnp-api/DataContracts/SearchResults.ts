// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {MetaModelMetaData} from './MetaModelMetaData';

export interface SearchResults {
  continuationToken: string;
  results: MetaModelMetaData[];
}