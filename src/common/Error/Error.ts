import { ExtensionName } from '../../Models/Interfaces/Api';

// User Error
/**
 * Error class used when user cancel operation.
 */
export class OperationCanceledError extends Error {
  constructor (message: string) {
    super(`Operation cancelled: ${message}`);
    this.name = 'CancelOperationError';
  }
}

/**
 * Error class used when remote environment does not support a operation.
 */
export class RemoteEnvNotSupportedError extends Error {
  /**
   * Construct a remote environemt not supported error.
   * @param suggestedOperation message of the recommended operation for user
   */
  constructor (suggestedOperation: string) {
    super(`The operation is not supported to be run in remote environment. ${
      suggestedOperation}`);
    this.name = 'RemoteEnvNotSupportedError';
  }
}

/**
 * Error class used when resource (file, directory, etc) is not found
 */
export class ResourceNotFoundError extends Error {
  /**
   * Construct a resource not found error.
   * @param resource The name of resource that is missing
   * @param suggestedOperation Recommended operation for user.
   */
  constructor (
    operation: string, resource: string, suggestedOperation?: string) {
    super(`Failed to ${operation}: Unable to find ${resource}. ${
      suggestedOperation}`);
    this.name = 'ResourceNotFoundError';
  }
}

export class DependentExtensionNotFoundError extends Error {
  constructor (extension: ExtensionName) {
    super(`Dependent extension ${
      extension} is not found. Please install it from Marketplace.`);
    this.name = 'DependentExtensionNotFound';
  }
}

export class WorkspaceNotOpenError extends Error {
  constructor () {
    super(
      'You have not yet opened a folder in Visual Studio Code. Please select a folder first.');
    this.name = 'WorkspaceNotOpenError';
  }
}

export class PrerequisiteNotMetError extends Error {
  constructor (operation: string, suggestedOperation?: string) {
    super(`Failed to ${operation} because prerequisite is not met. ${
      suggestedOperation}`);
    this.name = 'PrerequisiteNotMetError';
  }
}

// System Error
export class OperationFailedError extends Error {
  constructor (operation: string, suggestedOperation?: string) {
    super(`Failed to ${operation}. ${suggestedOperation}`);
    this.name = 'OperationFailedError';
  }
}

export class BoardNotFoundError extends Error {
  constructor (board: string) {
    super(`${board} is not found in board list.`);
    this.name = 'BoardNotFoundError';
  }
}

export class ConfigNotFoundError extends Error {
  constructor (configKey: string, suggestedOperation?: string) {
    super(`Failed to get ${configKey} from workspace settings. ${
      suggestedOperation}`);
    this.name = 'ConfigNotFoundError';
  }
}

export class TypeNotSupportedError extends Error {
  constructor (typeName: string, typeValue: string) {
    super(`Unsupported ${typeName}: ${typeValue}`);
    this.name = 'TypeNotSupportedError';
  }
}

export class InternalError extends Error {
  constructor (message: string) {
    super(`Internal Error: ${message}.`);
    this.name = 'InternalError';
  }
}

export class ArgumentEmptyOrNullError extends Error {
  constructor (argument: string, suggestedOperation?: string) {
    super(`Argument ${argument} is empty or null. ${suggestedOperation}`);
    this.name = 'ArgumentEmptyOrNullError';
  }
}

export class ArgumentInvalidError extends Error {
  constructor (argument: string, suggestedOperation?: string) {
    super(`${argument} is invalid. ${suggestedOperation}`);
    this.name = 'ArgumentInvalidError';
  }
}
