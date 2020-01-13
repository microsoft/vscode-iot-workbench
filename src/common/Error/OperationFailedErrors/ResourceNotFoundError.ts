import { OperationFailedError } from "./OperationFailedError";

/**
 * Error class used when resource (file, directory, etc) is not found
 */
export class ResourceNotFoundError extends OperationFailedError {
  /**
   * Construct a resource not found error.
   * @param resource The name of resource that is missing
   * @param suggestedOperation Recommended operation for user.
   */
  constructor(operation: string, resource: string, suggestedOperation?: string) {
    super(`Failed to ${operation}: Unable to find ${resource}.`, suggestedOperation);
    this.name = "ResourceNotFoundError";
  }
}
