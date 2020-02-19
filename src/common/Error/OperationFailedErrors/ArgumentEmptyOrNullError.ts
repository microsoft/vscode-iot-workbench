import { OperationFailedError } from "./OperationFailedError";

/**
 * Used when argument is empty or null.
 */
export class ArgumentEmptyOrNullError extends OperationFailedError {
  /**
   * Construct a argument empty or null error.
   * @param operation the failed operation
   * @param argument the empty or null argument name
   * @param suggestedOperation suggested operation for user to handle the failure
   */
  constructor(operation: string, argument: string, suggestedOperation?: string) {
    super(operation, `Argument ${argument} is empty or null.`, suggestedOperation || "");
    this.name = "ArgumentEmptyOrNullError";
  }
}
