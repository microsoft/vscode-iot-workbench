// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import {ComponentInfo, DependencyConfig} from '../AzureComponentConfig';
import {ScaffoldType} from '../../constants';

export interface Provisionable {
  dependencies: DependencyConfig[];
  provision(): Promise<boolean>;
  updateConfigSettings(type: ScaffoldType, componentInfo?: ComponentInfo): void;
}
