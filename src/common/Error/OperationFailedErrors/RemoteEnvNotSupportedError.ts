import { OperationFailedError } from "./OperationFailedError";

/**
 * Used when user tries to execute an operation that is not supported to run in remote environment.
 * Ask user to open window locally and try the command again.
 */
export class RemoteEnvNotSupportedError extends OperationFailedError {
  /**
   * Construct a remote environemt not supported error.
   * @param suggestedOperation message of the recommended operation for user
   */
  constructor(operation: string) {
    const suggestedOperation = "Open a new window and run this command again";
    super(operation, `The operation is not supported to be run in remote environment.`, suggestedOperation);
    this.name = "RemoteEnvNotSupportedError";
  }
}
