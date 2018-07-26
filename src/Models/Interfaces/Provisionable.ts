// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import {DependencyConfig} from '../AzureComponentConfig';
import {AzureUtility} from '../AzureUtility';

export interface Provisionable {
  dependencies: DependencyConfig[];
  provision(): Promise<boolean>;
}
