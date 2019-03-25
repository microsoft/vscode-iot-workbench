
export enum CodeGenDeviceType {
  General = 1,
  Boilerplate = 2,
  IoTDevKit = 3
}

export enum ProvisionType {
  DeviceConnectionString = 1,
  IoTCSasKey = 2,
  IoTCX509 = 3
}

export interface CodeGenerator {
  GenerateCode(
      targetPath: string, filePath: string, fileCoreName: string,
      connectionString: string): Promise<boolean>;
}