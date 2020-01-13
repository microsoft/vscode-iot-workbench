/**
 * Used when one operation failed.
 */
export class OperationFailedError extends Error {
  /**
   * Construct operation failed error.
   * @param errorMessage failure reason
   * @param suggestedOperation recommended method for user to handle the failure
   */
  constructor(errorMessage: string, suggestedOperation?: string) {
    super(`Operation failed: ${errorMessage} ${suggestedOperation}`);
    this.name = "OperationFailedError";
  }
}
