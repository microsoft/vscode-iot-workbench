// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { OperatingResult } from '../../OperatingResult';

export interface Compilable { compile(): Promise<OperatingResult>; }
