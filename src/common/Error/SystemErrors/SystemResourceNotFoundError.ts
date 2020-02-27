import { SystemError } from "./SystemError";

/**
 * Used when try to get items from system resource file with searching key but failed.
 */
export class SystemResourceNotFoundError extends SystemError {
  /**
   * Construct a system resource not found error.
   * @param targetResource name of target resource wanted from system template resource
   * @param searchingKey searching key used to search target resource
   * @param systemResource name of system resource
   */
  constructor(targetResource: string, searchingKey: string, systemResource: string) {
    super(`Unable to find available ${targetResource} using ${searchingKey} \
    from system resource ${systemResource}.`);
    this.name = "SystemResourceNotFoundError";
  }
}
