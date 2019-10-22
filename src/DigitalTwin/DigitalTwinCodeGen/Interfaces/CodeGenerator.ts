export enum CodeGenLanguage {
  ANSIC = 'ANSI C'
}

export enum DeviceConnectionType {
  DeviceConnectionString = 'DeviceConnectionString',
  SymmetricKey = 'SymmetricKey',
  IoTCX509 = 'IoTCX509'
}

export enum CodeGenProjectType {
  CMakeWindows = 'CMake-Windows',
  CMakeLinux = 'CMake-Linux',
  VisualStudio = 'VisualStudio',
  IoTDevKit = 'IoTDevKit'
}

export enum DeviceSdkReferenceType {
  Vcpkg = 'Vcpkg',
  SourceCode = 'SourceCode',
  DevKitSDK = 'DevKitSDK'
}

export enum CodeGenPlatform {
  Windows = 'Windows',
  Linux = 'Linux',
  MacOS = 'MacOS'
}

export interface CodeGenerator {
  generateCode(
      targetPath: string, filePath: string, capabilityModelName: string,
      dcmId: string, interfaceDir: string): Promise<boolean>;
}
