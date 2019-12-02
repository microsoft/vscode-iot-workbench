// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import {ConfigKey} from './constants';

export class ConfigHandler {
  static async update(
      key: string, value: {}, target = vscode.ConfigurationTarget.Workspace) {
    if (!key) {
      throw new Error('Key is empty.');
    }
    return await vscode.workspace.getConfiguration(ConfigKey.extensionName)
        .update(key, value, target);
  }

  static get<T>(key: string) {
    if (!key) {
      throw new Error('Key is empty.');
    }
    return vscode.workspace.getConfiguration(ConfigKey.extensionName)
        .get<T>(key);
  }
}