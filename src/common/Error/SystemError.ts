export class SystemError extends Error {
  constructor(errorMessage: string) {
    super(`System Error:  ${errorMessage}}`);
    this.name = "SystemError";
  }
}
