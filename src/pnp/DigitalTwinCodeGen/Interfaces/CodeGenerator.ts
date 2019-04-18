
export enum CodeGenDeviceType {
  General = 1,
  IoTDevKit = 2
}

export enum DeviceConnectionType {
  DeviceConnectionString = 1,
  IoTCSasKey = 2,
  IoTCX509 = 3
}

export interface CodeGenerator {
  GenerateCode(
      targetPath: string, filePath: string, fileCoreName: string,
      connectionString: string): Promise<boolean>;
}