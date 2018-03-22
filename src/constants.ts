// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export class ConfigKey {
  static readonly devicePath = 'DevicePath';
  static readonly iotHubConnectionString = 'iothubConnectionString';
  static readonly iotHubDeviceConnectionString = 'iothubDeviceConnectionString';
  static readonly eventHubConnectionString = 'eventHubConnectionString';
  static readonly eventHubConnectionPath = 'eventHubConnectionPath';
  static readonly functionAppId = 'functionAppId';
  static readonly functionPath = 'FunctionPath';
}

export class DeviceConfig {
  static readonly defaultBaudRate = 115200;
  static readonly az3166ComPortVendorId = '0483';
  static readonly az3166ComPortProductId = '374b';
}

export class EventNames {
  static readonly createNewProjectEvent = 'IoTWorkbench.New';
  static readonly azureProvisionEvent = 'IoTWorkbench.AzureProvision';
  static readonly azureDeployEvent = 'IoTWorkbench.AzureDeploy';
  static readonly createAzureFunctionsEvent = 'IoTWorkbench.CreateAzureFunctions';
  static readonly deviceCompileEvent = 'IoTWorkbench.DeviceCompile';
  static readonly deviceUploadEvent = 'IoTWorkbench.DeviceUpload';
  static readonly setDeviceConnectionStringEvent =
      'IoTWorkbench.SetDeviceConnectionString';
  static readonly loadExampleEvent = 'IoTWorkbench.loadExample';
}