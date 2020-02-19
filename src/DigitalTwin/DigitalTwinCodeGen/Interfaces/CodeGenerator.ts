export enum CodeGenLanguage {
  ANSIC = "ANSI C"
}

export enum DeviceConnectionType {
  ConnectionString = "ConnectionString",
  DpsSasKey = "DpsSasKey",
  IoTCX509 = "IoTCX509"
}

export enum CodeGenProjectType {
  CMakeWindows = "CMake_Windows",
  CMakeLinux = "CMake_Linux",
  VisualStudio = "VisualStudio",
  IoTDevKit = "IoTDevKit"
}

export enum DeviceSdkReferenceType {
  Vcpkg = "Vcpkg",
  SourceCode = "SourceCode",
  DevKitSDK = "DevKitSDK"
}

export enum CodeGenPlatform {
  Windows = "Windows",
  Linux = "Linux",
  MacOS = "MacOS"
}

export interface CodeGenExecutionItem {
  outputDirectory: string;
  capabilityModelFilePath: string;
  interfaceDirecoty: string;
  projectName: string;
  languageLabel: string;
  codeGenProjectType: CodeGenProjectType;
  deviceSdkReferenceType: DeviceSdkReferenceType;
  deviceConnectionType: DeviceConnectionType;
}

export interface CodeGenerator {
  generateCode(codegenInfo: CodeGenExecutionItem): Promise<boolean>;
}
