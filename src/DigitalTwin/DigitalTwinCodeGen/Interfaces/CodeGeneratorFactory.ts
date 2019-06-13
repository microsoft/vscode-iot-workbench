import {CodeGenerator, CodeGenProjectType, DeviceConnectionType} from './CodeGenerator';


export interface CodeGeneratorFactory {
  CreateCodeGeneratorImpl(
      deviceType: CodeGenProjectType,
      connectionType: DeviceConnectionType): CodeGenerator|null;
}
