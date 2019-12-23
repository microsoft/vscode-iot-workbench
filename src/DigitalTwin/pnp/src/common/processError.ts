// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ColorizedChannel } from "./colorizedChannel";

/**
 * Error for processing failure
 */
export class ProcessError extends Error {
  constructor(operation: string, error: Error, readonly component: string) {
    super(ColorizedChannel.formatMessage(operation, error));
    this.name = "ProcessError";
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProcessError);
    }
  }
}
