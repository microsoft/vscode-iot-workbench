import { OperationFailedError } from "./OperationFailedError";

/**
 * Used when Azure Digital Twin instance is not initialized.
 */
export class DigitalTwinNotInitializedError extends OperationFailedError {
  /**
   * Construct a digital twin not initialized error.
   */
  constructor(operation: string) {
    super(operation, "Azure Digital Twin extension is not initialized.", "Please initialize the extension first.");
    this.name = "DigitalTwinNotInitializedError";
  }
}
