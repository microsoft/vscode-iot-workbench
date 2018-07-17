// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import {Guid} from 'guid-typescript';

export interface Provisionable {
  dependencies: string[];
  provision(): Promise<boolean>;
}
