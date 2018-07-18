// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import {Guid} from 'guid-typescript';
import {Azure} from '../Azure';

export interface Provisionable {
  dependencies: string[];
  provision(azure: Azure): Promise<boolean>;
}
