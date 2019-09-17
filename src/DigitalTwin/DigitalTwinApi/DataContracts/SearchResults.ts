// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { DigitalTwinModelBase } from './DigitalTwinModel';

export interface SearchResults {
  continuationToken?: string;
  results: DigitalTwinModelBase[];
}
