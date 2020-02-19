import { OperationFailedError } from "./OperationFailedError";

/**
 * Used when no folder is open in VS Code. Ask user to open a folder first.
 */
export class WorkspaceNotOpenError extends OperationFailedError {
  /**
   * Construct a workspace not open error.
   * @param operation the failed operation
   */
  constructor(operation: string) {
    super(operation, "You have not yet opened a folder in Visual Studio Code.", "Please select a folder first.");
    this.name = "WorkspaceNotOpenError";
  }
}
