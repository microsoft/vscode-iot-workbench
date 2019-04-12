import {CodeGenDeviceType, CodeGenerator, DeviceConnectionType} from './CodeGenerator';


export interface CodeGeneratorFactory {
  CreateCodeGeneratorImpl(
      deviceType: CodeGenDeviceType,
      connectionType: DeviceConnectionType): CodeGenerator|null;
}
