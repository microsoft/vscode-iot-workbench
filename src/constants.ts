export class ConfigKey {
  static readonly iotHubConnectionString = 'iothubConnectionString';
  static readonly iotHubDeviceConnectionString = 'iothubDeviceConnectionString';
  static readonly eventHubConnectionString = 'eventHubConnectionString';
  static readonly eventHubConnectionPath = 'eventHubConnectionPath';
  static readonly functionAppId = 'functionAppId';
}

export class DeviceConfig {
  static readonly defaultBaudRate = 115200;
  static readonly az3166ComPortVendorId = '0483';
  static readonly az3166ComPortProductId = '374b';
}
