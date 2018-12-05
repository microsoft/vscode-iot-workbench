import {CodeGenDeviceType, CodeGenerator} from './CodeGenerator';


export interface CodeGeneratorFactory {
  CreateCodeGeneratorImpl(deviceType: CodeGenDeviceType): CodeGenerator|null;
}
