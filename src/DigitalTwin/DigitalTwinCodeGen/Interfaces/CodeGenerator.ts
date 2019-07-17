
export enum CodeGenProjectType {
  CMake = 'CMake',
  VisualStudio = 'VisualStudio',
  IoTDevKit = 'IoTDevKit'
}

export enum DeviceConnectionType {
  DeviceConnectionString = 'DeviceConnectionString',
  IoTCSasKey = 'IoTCSasKey',
  IoTCX509 = 'IoTCX509'
}

export enum PnpLanguage {
  ANSIC = 'ANSI C'
}

export interface CodeGenerator {
  GenerateCode(
      targetPath: string, filePath: string, fileCoreName: string,
      connectionString: string): Promise<boolean>;
}