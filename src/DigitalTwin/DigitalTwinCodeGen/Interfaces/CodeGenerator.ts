
export enum CodeGenProjectType {
  CMake = 1,
  VisualStudio = 2,
  IoTDevKit = 3
}

export enum DeviceConnectionType {
  DeviceConnectionString = 1,
  IoTCSasKey = 2,
  IoTCX509 = 3
}

export interface CodeGenerator {
  GenerateCode(
      targetPath: string, filePath: string, capabilityModelName: string,
      connectionString: string): Promise<boolean>;
}