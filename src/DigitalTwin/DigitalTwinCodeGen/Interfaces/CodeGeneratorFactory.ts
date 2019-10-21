import {CodeGenerator, CodeGenProjectType, DeviceConnectionType, DeviceSdkReferenceType} from './CodeGenerator';


export interface CodeGeneratorFactory {
  createCodeGeneratorImpl(
      projectType: CodeGenProjectType, sdkReferenceType: DeviceSdkReferenceType,
      connectionType: DeviceConnectionType): CodeGenerator|null;
}
