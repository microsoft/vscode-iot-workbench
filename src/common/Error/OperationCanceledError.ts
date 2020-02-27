/**
 * Used when user cancel operation.
 */
export class OperationCanceledError extends Error {
  /**
   * Construct operation canceled error.
   * @param errorMessage failure reason
   */
  constructor(errorMessage: string) {
    super(`Operation cancelled: ${errorMessage}`);
    this.name = "CancelOperationError";
  }
}
