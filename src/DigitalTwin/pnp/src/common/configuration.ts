// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import { Constants } from "./constants";

/**
 * Extension configuration, stored as name/value pair
 */
export class Configuration {
  /**
   * get configuration property by name
   * @param name property name
   */
  static getProperty<T>(name: string): T | undefined {
    return Configuration.instance.get<T>(name);
  }

  /**
   * set global property
   * @param name property name
   * @param value property value
   */
  // tslint:disable-next-line:no-any
  static async setGlobalProperty(name: string, value: any): Promise<void> {
    await Configuration.instance.update(name, value, true);
  }

  /**
   * set workspace property
   * @param name property name
   * @param value property value
   */
  // tslint:disable-next-line:no-any
  static async setWorkspaceProperty(name: string, value: any): Promise<void> {
    await Configuration.instance.update(name, value, false);
  }

  private static readonly instance: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
    Constants.EXTENSION_NAME,
  );
  private constructor() {}
}
