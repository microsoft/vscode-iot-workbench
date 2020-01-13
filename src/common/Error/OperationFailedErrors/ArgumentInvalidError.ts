import { OperationFailedError } from "./OperationFailedError";

/**
 * Used when argument is invalid.
 * e.g. path argument does not exists.
 */
export class ArgumentInvalidError extends OperationFailedError {
  /**
   * Construct a argument invalid error.
   * @param argument the invalid argument name
   * @param suggestedOperation suggested operation for user to handle the failure
   */
  constructor(argument: string, suggestedOperation?: string) {
    super(`${argument} is invalid.`, suggestedOperation);
    this.name = "ArgumentInvalidError";
  }
}
