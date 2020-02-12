import { ResourceNotFoundError } from "./ResourceNotFoundError";

/**
 * Used when file not found.
 */
export class FileNotFoundError extends ResourceNotFoundError {
  /**
   * Construct a file not found error.
   * @param operation the failed operation
   * @param file The missing file
   * @param suggestedOperation Recommended operation for user.
   */
  constructor(operation: string, file: string, suggestedOperation: string) {
    super(operation, `${file}`, suggestedOperation);
    this.name = "FileNotFoundError";
  }
}
