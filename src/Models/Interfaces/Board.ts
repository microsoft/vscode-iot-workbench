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
  detailInfo: string;
  defaultBaudRate?: number;
  vendorId?: string;
  productId?: string;
  exampleUrl?: string;
  examplePageName?: string;
  helpUrl?: string;
  installation?: BoardInstallation;
}

export interface BoardQuickPickItem extends vscode.QuickPickItem, Board {}