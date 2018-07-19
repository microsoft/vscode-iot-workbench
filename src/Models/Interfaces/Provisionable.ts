// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import {Azure} from '../Azure';
import {DependencyConfig} from '../AzureComponentConfig';

export interface Provisionable {
  dependencies: DependencyConfig[];
  provision(azure: Azure): Promise<boolean>;
}
