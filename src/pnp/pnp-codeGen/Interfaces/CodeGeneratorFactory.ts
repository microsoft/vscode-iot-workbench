import {CodeGenDeviceType, CodeGenerator, ProvisionType} from './CodeGenerator';


export interface CodeGeneratorFactory {
  CreateCodeGeneratorImpl(
      deviceType: CodeGenDeviceType,
      provisionType: ProvisionType): CodeGenerator|null;
}
