import { SystemError } from "./SystemError";

/**
 * Used when type is not implemented in current system.
 */
export class TypeNotSupportedError extends SystemError {
  /**
   * Construct a type not supported error
   * @param typeName the name of the unsupported type
   * @param typeValue the value of the unsupported type
   */
  constructor(typeName: string, typeValue: string) {
    super(`Unsupported ${typeName}: ${typeValue}`);
    this.name = "TypeNotSupportedError";
  }
}
