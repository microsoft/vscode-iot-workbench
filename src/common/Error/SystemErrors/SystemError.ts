/**
 * Used when the program hits system error.
 * This kind of error has less to do with user operation than bad program system implementation.
 */
export class SystemError extends Error {
  /**
   * Construct system error.
   * @param errorMessage failure reason
   */
  constructor(errorMessage: string) {
    super(`System Error:  ${errorMessage}}`);
    this.name = "SystemError";
  }
}
