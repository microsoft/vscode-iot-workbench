
export enum CodeGenDeviceType {
  General = 1,
  IoTDevKit = 2
}

export interface CodeGenerator {
  GenerateCode(
      targetPath: string, filePath: string, fileCoreName: string,
      connectionString: string): Promise<boolean>;
}