// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {PnPModelBase} from './PnPModel';

export interface SearchResults {
  continuationToken?: string;
  results: PnPModelBase[];
}