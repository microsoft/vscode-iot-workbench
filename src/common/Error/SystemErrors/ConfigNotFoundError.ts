import { SystemError } from "./SystemError";

export class ConfigNotFoundError extends SystemError {
  constructor(configKey: string, suggestedOperation?: string) {
    super(`Failed to get ${configKey} from workspace settings. ${suggestedOperation}`);
    this.name = "ConfigNotFoundError";
  }
}
