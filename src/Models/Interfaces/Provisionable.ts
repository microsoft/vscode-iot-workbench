// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import {ComponentInfo, DependencyConfig} from '../AzureComponentConfig';

export interface Provisionable {
  dependencies: DependencyConfig[];
  provision(): Promise<boolean>;
  updateConfigSettings(componentInfo?: ComponentInfo): void;
}
