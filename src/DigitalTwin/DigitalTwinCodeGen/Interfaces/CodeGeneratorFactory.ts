import {CodeGenerator, CodeGenProjectType, DeviceConnectionType} from './CodeGenerator';


export interface CodeGeneratorFactory {
  createCodeGeneratorImpl(
      deviceType: CodeGenProjectType,
      connectionType: DeviceConnectionType): CodeGenerator|null;
}
