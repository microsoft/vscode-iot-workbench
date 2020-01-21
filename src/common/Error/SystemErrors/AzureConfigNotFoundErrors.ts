import { SystemError } from "./SystemError";

/**
 * Used when fail to get configuration value using key from workspace settings.
 */
export class AzureConfigNotFoundError extends SystemError {
  /**
   * Construct a config not found error.
   * @param errorMsg Error Message
   */
  constructor(errorMsg: string) {
    super(`Failed to get Azure configuration ${errorMsg}.`);
    this.name = "AzureConfigNotFoundError";
  }
}
