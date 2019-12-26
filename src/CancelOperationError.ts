export class CancelOperationError extends Error {
  constructor(message: string) {
    super(`Operation cancelled: ${message}`);
    this.name = 'CancelOperationError';
  }
}