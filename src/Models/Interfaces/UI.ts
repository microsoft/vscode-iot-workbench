// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { QuickPickItem } from 'vscode';

export interface PickWithData<T> extends QuickPickItem {
  data: T;
}
