import { InternalError } from './InternalError';

export class BoardNotFoundError extends InternalError {
  constructor (board: string) {
    const errorMessage = `${board} is not found in board list.`;
    super(errorMessage);
    this.name = 'BoardNotFoundError';
  }
}
