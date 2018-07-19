// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import {Azure} from '../Azure';
import {ComponentDependency} from '../AzureComponentConfig';

export interface Provisionable {
  dependencies: ComponentDependency[];
  provision(azure: Azure): Promise<boolean>;
}
