// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as keytar from "keytar";
import { Constants } from "./constants";

/**
 * Credential store for user secret information, stored as name/value pair
 */
export class CredentialStore {
  /**
   * get credential value
   * @param name credential name
   */
  static async get(name: string): Promise<string | null> {
    return keytar.getPassword(Constants.EXTENSION_NAME, name);
  }

  /**
   * set credential
   * @param name credential name
   * @param value credential value
   */
  static async set(name: string, value: string): Promise<void> {
    await keytar.setPassword(Constants.EXTENSION_NAME, name, value);
  }

  /**
   * delete credential
   * @param name credential name
   */
  static async delete(name: string): Promise<boolean> {
    return keytar.deletePassword(Constants.EXTENSION_NAME, name);
  }

  private constructor() {}
}
