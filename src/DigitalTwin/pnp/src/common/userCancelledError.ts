// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

/**
 * Error for user cancel operation
 */
export class UserCancelledError extends Error {
  constructor(operation?: string) {
    const message = operation ? ` [${operation}]` : "";
    super("User cancelled the operation" + message);
    this.name = "UserCancelledError";
  }
}
