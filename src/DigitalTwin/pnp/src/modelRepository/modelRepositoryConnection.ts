// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { createHmac } from "crypto";
import { Constants } from "../common/constants";

/**
 * Model repository connection
 */
export class ModelRepositoryConnection {
  /**
   * parse connection string, validate and return model repository connection
   * @param connectionString connection string
   */
  static parse(connectionString: string): ModelRepositoryConnection {
    if (!connectionString) {
      throw new Error(`Connection string ${Constants.NOT_EMPTY_MSG}`);
    }
    const map: { [key: string]: string } = {};
    const properties: string[] = connectionString.split(";");
    if (properties.length !== ModelRepositoryConnection.PROPERTY_COUNT) {
      throw new Error(Constants.CONNECTION_STRING_INVALID_FORMAT_MSG);
    }
    for (const property of properties) {
      const index: number = property.indexOf("=");
      if (index <= 0) {
        throw new Error(Constants.CONNECTION_STRING_INVALID_FORMAT_MSG);
      }
      const name: string = property.slice(0, index);
      const value: string = property.slice(index + 1);
      if (!name || !value) {
        throw new Error(Constants.CONNECTION_STRING_INVALID_FORMAT_MSG);
      }
      map[name] = value;
    }
    // validate connection
    const connection = new ModelRepositoryConnection(
      map[ModelRepositoryConnection.HOSTNAME_PROPERTY],
      map[ModelRepositoryConnection.REPOSITORY_ID_PROPERTY],
      map[ModelRepositoryConnection.SHARED_ACCESS_KEY_NAME_PROPERTY],
      map[ModelRepositoryConnection.SHARED_ACCESS_KEY_PROPERTY]
    );
    connection.validate();
    return connection;
  }

  private static readonly PROPERTY_COUNT = 4;
  private static readonly HOSTNAME_PROPERTY = "HostName";
  private static readonly REPOSITORY_ID_PROPERTY = "RepositoryId";
  private static readonly SHARED_ACCESS_KEY_NAME_PROPERTY =
    "SharedAccessKeyName";
  private static readonly SHARED_ACCESS_KEY_PROPERTY = "SharedAccessKey";
  private static readonly HOSTNAME_REGEX = new RegExp("[a-zA-Z0-9_\\-\\.]+$");
  private static readonly SHARED_ACCESS_KEY_NAME_REGEX = new RegExp(
    "^[a-zA-Z0-9_\\-@\\.]+$"
  );
  private static readonly EXPIRY_IN_MINUTES = 30;

  private readonly expiry: string;
  private constructor(
    readonly hostName: string,
    readonly repositoryId: string,
    readonly sharedAccessKeyName: string,
    readonly sharedAccessKey: string
  ) {
    const now: number = new Date().getTime();
    this.expiry = (
      Math.round(now / 1000) +
      ModelRepositoryConnection.EXPIRY_IN_MINUTES * 60
    ).toString();
  }

  /**
   * generate access token
   */
  generateAccessToken(): string {
    const endpoint: string = encodeURIComponent(this.hostName);
    const payload: string = [
      encodeURIComponent(this.repositoryId),
      endpoint,
      this.expiry
    ]
      .join("\n")
      .toLowerCase();
    const signature: Buffer = Buffer.from(payload, Constants.UTF8);
    const secret: Buffer = Buffer.from(this.sharedAccessKey, Constants.BASE64);
    const hash: string = encodeURIComponent(
      createHmac(Constants.SHA256, secret)
        .update(signature)
        .digest(Constants.BASE64)
    );
    return (
      "SharedAccessSignature " +
      `sr=${endpoint}&sig=${hash}&se=${this.expiry}&skn=${this.sharedAccessKeyName}&rid=${this.repositoryId}`
    );
  }

  /**
   * validate model repository connection
   */
  private validate(): void {
    if (
      !this.hostName ||
      !ModelRepositoryConnection.HOSTNAME_REGEX.test(this.hostName)
    ) {
      throw new Error(
        `${Constants.CONNECTION_STRING_INVALID_FORMAT_MSG} on property ${ModelRepositoryConnection.HOSTNAME_PROPERTY}`
      );
    }
    if (!this.repositoryId) {
      throw new Error(
        `${Constants.CONNECTION_STRING_INVALID_FORMAT_MSG} on \
        property ${ModelRepositoryConnection.REPOSITORY_ID_PROPERTY}`
      );
    }
    if (
      !this.sharedAccessKeyName ||
      !ModelRepositoryConnection.SHARED_ACCESS_KEY_NAME_REGEX.test(
        this.sharedAccessKeyName
      )
    ) {
      throw new Error(
        `${Constants.CONNECTION_STRING_INVALID_FORMAT_MSG} on \
        property ${ModelRepositoryConnection.SHARED_ACCESS_KEY_NAME_PROPERTY}`
      );
    }
    if (!this.sharedAccessKey) {
      throw new Error(
        `${Constants.CONNECTION_STRING_INVALID_FORMAT_MSG} on \
        property ${ModelRepositoryConnection.SHARED_ACCESS_KEY_PROPERTY}`
      );
    }
  }
}
