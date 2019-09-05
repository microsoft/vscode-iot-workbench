export class CancelOperationError extends Error {
  constructor(message: string) {
    super(`Openration cancelled: ${message}`);
    this.name = 'CancelOperationError';
  }
}