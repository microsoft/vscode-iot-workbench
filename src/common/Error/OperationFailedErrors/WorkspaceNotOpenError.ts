export class WorkspaceNotOpenError extends Error {
  constructor() {
    super(`You have not yet opened a folder in Visual Studio Code. Please select a folder first.`);
    this.name = "WorkspaceNotOpenError";
  }
}
