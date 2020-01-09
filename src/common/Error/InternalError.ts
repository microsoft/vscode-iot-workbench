export class InternalError extends Error {
  constructor (errorMessage: string) {
    super(`Internal Error: ${errorMessage}.`);
    this.name = 'InternalError';
  }
}
/*
- BoardNotFoundError
- TypeNotSupportedError
*/

export class UserError extends Error {
  constructor (operation: string, suggestedOperation?: string) {
    super(`Failed to ${operation}. ${suggestedOperation}`);
    this.name = 'UserError';
  }
}

export class OperationCanceledError extends UserError {
  constructor (message: string) {
    super(`Operation cancelled: ${message}`);
    this.name = 'CancelOperationError';
  }
}
