export class OperationFailedError extends Error {
  constructor(operation: string, suggestedOperation?: string) {
    super(`Failed to ${operation}. ${suggestedOperation}`);
    this.name = "OperationFailedError";
  }
}
