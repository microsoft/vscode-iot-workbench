export enum CodeGenProjectType {
  CMake = 'CMake',
  VisualStudio = 'VisualStudio',
  IoTDevKit = 'IoTDevKit'
}

export enum DeviceConnectionType {
  DeviceConnectionString = 'DeviceConnectionString',
  SymmetricKey = 'SymmetricKey',
  IoTCX509 = 'IoTCX509'
}

export enum PnpLanguage {
  ANSIC = 'ANSI C'
}

export interface CodeGenerator {
  GenerateCode(
      targetPath: string, filePath: string, capabilityModelName: string,
      interfaceDir: string): Promise<boolean>;
}
