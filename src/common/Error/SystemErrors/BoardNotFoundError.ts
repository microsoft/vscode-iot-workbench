import { SystemError } from "./SystemError";

export class BoardNotFoundError extends SystemError {
  constructor(board: string) {
    super(`${board} is not found in board list.`);
    this.name = "BoardNotFoundError";
  }
}
