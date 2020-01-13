export class ConfigNotFoundError extends Error {
  constructor(configKey: string, suggestedOperation?: string) {
    super(`Failed to get ${configKey} from workspace settings. ${suggestedOperation}`);
    this.name = "ConfigNotFoundError";
  }
}
