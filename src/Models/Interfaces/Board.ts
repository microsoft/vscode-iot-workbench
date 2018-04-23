// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';

export interface BoardInstallation {
  additionalUrl: string;
  packageName: string;
  architecture: string;
}

export interface Board {
  name: string;
  id: string;
  platform: string;
  installation?: BoardInstallation;
}

export interface BoardQuickPickItem extends vscode.QuickPickItem, Board {}