import { SystemError } from "./SystemError";

/**
 * Used when fail to get configuration value using key from project configuration file.
 */
export class ProjectConfigNotFoundError extends SystemError {
  /**
   * Construct a project config not found error.
   * @param configKey configuration key
   */
  constructor(configKey: string, projectConfigurationFile: string) {
    super(`Failed to get configuration value of key ${configKey} \
    from project configuration file ${projectConfigurationFile}.`);
    this.name = "ProjectConfigNotFoundError";
  }
}
