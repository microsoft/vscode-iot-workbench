export enum WorkbenchCommands {
  // workbench commands
  InitializeProject = 'iotworkbench.initializeProject',
  ConfigureProjectEnvironment = 'iotworkbench.configureProjectEnvironment',
  Examples = 'iotworkbench.examples',
  Help = 'iotworkbench.help',
  Workbench = 'iotworkbench.workbench',
  DeviceCompile = 'iotworkbench.deviceCompile',
  DeviceUpload = 'iotworkbench.deviceUpload',
  AzureProvision = 'iotworkbench.azureProvision',
  AzureDeploy = 'iotworkbench.azureDeploy',
  ConfigureDevice = 'iotworkbench.configureDevice',
  IotPnPGenerateCode = 'iotworkbench.iotPnPGenerateCode',

  // Workbench internal commands
  ExampleInitialize = 'iotworkbench.exampleInitialize',
  SendTelemetry = 'iotworkbench.sendTelemetry',
  OpenUri = 'iotworkbench.openUri',
  HttpRequest = 'iotworkbench.httpRequest',
  GetDisableAutoPopupLandingPage =
      'iotworkbench.getDisableAutoPopupLandingPage',
  SetDisableAutoPopupLandingPage = 'iotworkbench.setDisableAutoPopupLandingPage'
}

export enum VscodeCommands {
  // vscode commands
  VscodeOpen = 'vscode.open',
  VscodeOpenFolder = 'vscode.openFolder'
}

export enum RemoteContainersCommands {
  // remote-containers commands
  ReopenInContainer = 'remote-containers.reopenInContainer',
  OpenFolder = 'remote-containers.openFolder'
}

export enum ArduinoCommands {
  // arduino commands
  InstallBoard = 'arduino.installBoard',
  CloseSerialMonitor = 'arduino.closeSerialMonitor',
}

export enum AzureAccountCommands {
  Login = 'azure-account.login',
}

export enum AzureFunctionsCommands {
  CreateNewProject = 'azureFunctions.createNewProject',
  CreateFunctionApp = 'azureFunctions.createFunctionApp',
  Deploy = 'azureFunctions.deploy'
}

export enum IoTCubeCommands {
  OpenLocally = 'iotcube.openLocally'
}