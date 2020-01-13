export class BoardNotFoundError extends Error {
  constructor(board: string) {
    super(`${board} is not found in board list.`);
    this.name = "BoardNotFoundError";
  }
}
