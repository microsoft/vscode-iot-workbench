export class TypeNotSupportedError extends Error {
  constructor(typeName: string, typeValue: string) {
    super(`Unsupported ${typeName}: ${typeValue}`);
    this.name = "TypeNotSupportedError";
  }
}
