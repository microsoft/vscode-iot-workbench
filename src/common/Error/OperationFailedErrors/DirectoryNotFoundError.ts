import { ResourceNotFoundError } from "./ResourceNotFoundError";

/**
 * Used when directory not found.
 */
export class DirectoryNotFoundError extends ResourceNotFoundError {
  /**
   * Construct a directory not found error.
   * @param operation the failed operation
   * @param directory The missing directory
   * @param suggestedOperation Recommended operation for user.
   */
  constructor(operation: string, directory: string, suggestedOperation: string) {
    super(operation, `${directory}`, suggestedOperation);
    this.name = "DirectoryNotFoundError";
  }
}
