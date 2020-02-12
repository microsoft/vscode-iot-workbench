/**
 * Used when one operation failed.
 */
export class OperationFailedError extends Error {
  /**
   * Construct operation failed error.
   * @param operation the failed operation
   * @param errorMessage failure reason
   * @param suggestedOperation recommended method for user to handle the failure
   */
  constructor(operation: string, errorMessage: string, suggestedOperation: string) {
    super(`Failed to ${operation}. ${errorMessage} ${suggestedOperation}`);
    this.name = "OperationFailedError";
  }
}
