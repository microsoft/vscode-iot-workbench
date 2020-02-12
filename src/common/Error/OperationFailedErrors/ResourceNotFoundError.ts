import { OperationFailedError } from "./OperationFailedError";

/**
 * Used when the needed resource (file, directory, etc) is not found.
 * e.g. File does not exists
 */
export class ResourceNotFoundError extends OperationFailedError {
  /**
   * Construct a resource not found error.
   * @param resource The name of the missing resource
   * @param suggestedOperation Recommended operation for user.
   */
  constructor(operation: string, resource: string, suggestedOperation: string) {
    super(operation, `Unable to find ${resource}.`, suggestedOperation);
    this.name = "ResourceNotFoundError";
  }
}
