// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

/**
 * Error for user bad request
 */
export class BadRequestError extends Error {
  constructor(message: string) {
    super(`Bad request: ${message}`);
    this.name = "BadRequestError";
  }
}
