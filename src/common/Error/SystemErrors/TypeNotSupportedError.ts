import { SystemError } from "./SystemError";
export class TypeNotSupportedError extends SystemError {
  constructor(typeName: string, typeValue: string) {
    super(`Unsupported ${typeName}: ${typeValue}`);
    this.name = "TypeNotSupportedError";
  }
}
