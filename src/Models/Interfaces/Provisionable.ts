// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import {ComponentInfo, DependencyConfig} from '../AzureComponentConfig';

import { OperatingResult } from '../../OperatingResult';

export interface Provisionable {
  dependencies: DependencyConfig[];
  provision(): Promise<OperatingResult>;
  updateConfigSettings(componentInfo?: ComponentInfo): void;
}
