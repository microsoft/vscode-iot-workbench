// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';

export interface Board {
  name: string;
  id: string;
  platform: string;
}

export interface BoardQuickPickItem extends vscode.QuickPickItem, Board {}