import { SystemError } from "./SystemError";

/**
 * Used when fail to get configuration value using key from workspace settings.
 */
export class WorkspaceConfigNotFoundError extends SystemError {
  /**
   * Construct a config not found error.
   * @param configKey configuration key
   */
  constructor(configKey: string) {
    super(`Failed to get workspace configuration value of key ${configKey}.`);
    this.name = "WorkspaceConfigNotFoundError";
  }
}
