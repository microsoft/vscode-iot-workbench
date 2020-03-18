import { OperationFailedError } from "../OperationFailedErrors/OperationFailedError";
import { ModelType } from "../../../DigitalTwin/pnp/src/deviceModel/deviceModelManager";

export class PnPModelTypeInvalidError extends OperationFailedError {
  constructor(operation: string, type: ModelType) {
    super(operation, `Invalid model type: ${type}`, "");
    this.name = "PnPModelTypeInvalidError";
  }
}
