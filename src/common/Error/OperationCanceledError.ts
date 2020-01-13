/**
 * Error class used when user cancel operation.
 */
export class OperationCanceledError extends Error {
  constructor(message: string) {
    super(`Operation cancelled: ${message}`);
    this.name = "CancelOperationError";
  }
}
