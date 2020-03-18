import { ExtensionName } from "../../../Models/Interfaces/Api";
import { OperationFailedError } from "./OperationFailedError";

/**
 * Used when dependent extension is not installed.
 * Ask user to install depedent extension first.
 */
export class DependentExtensionNotFoundError extends OperationFailedError {
  /**
   * Construct a depedent extension not found error.
   * @param extension name of the depedent extension that's not found
   */
  constructor(operation: string, extension: ExtensionName) {
    super(operation, `Dependent extension ${extension} is not found.`, "Please install it from Marketplace.");
    this.name = "DependentExtensionNotFound";
  }
}
