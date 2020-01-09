import { InternalError } from './InternalError';

export class TypeNotSupportedError extends InternalError {
  constructor (typeName: string, typeValue: string) {
    super(`Unsupported ${typeName}: ${typeValue}`);
    this.name = 'TypeNotSupportedError';
  }
}
