// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import {VSCExpress} from 'vscode-express';
import {BoardProvider} from './boardProvider';
import {ProjectInitializer} from './projectInitializer';
import {DeviceOperator} from './DeviceOperator';
import {AzureOperator} from './AzureOperator';
import {IoTWorkbenchSettings} from './IoTSettings';
import {ConfigHandler} from './configHandler';
import {ConfigKey, EventNames, PlatformType, FileNames, platformFolderMap} from './constants';
import {TelemetryContext, TelemetryProperties} from './telemetry';

const impor = require('impor')(__dirname);
const exampleExplorerModule =
    impor('./exampleExplorer') as typeof import('./exampleExplorer');
const ioTProjectModule =
    impor('./Models/IoTProject') as typeof import('./Models/IoTProject');
const telemetryModule = impor('./telemetry') as typeof import('./telemetry');
const request = impor('request-promise') as typeof import('request-promise');
const usbDetectorModule =
    impor('./usbDetector') as typeof import('./usbDetector');

let telemetryWorkerInitialized = false;
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors
  // (console.error) This line of code will only be executed once when your
  // extension is activated
  console.log(
      'Congratulations, your extension "vscode-iot-workbench" is now active!');

  const outputChannel: vscode.OutputChannel =
      vscode.window.createOutputChannel('Azure IoT Device Workbench');

  const telemetryContext: TelemetryContext = {
    properties: {result: 'Succeeded', error: '', errorMessage: ''},
    measurements: {duration: 0}
  };

  if (vscode.workspace.workspaceFolders) {
    try {
      // Initialize Telemetry
      if (!telemetryWorkerInitialized) {
        telemetryModule.TelemetryWorker.Initialize(context);
        telemetryWorkerInitialized = true;
      }
      const iotProject = new ioTProjectModule.IoTProject(
          context, outputChannel, telemetryContext);
      await iotProject.load(true);
    } catch (error) {
      // do nothing as we are not sure whether the project is initialized.
    }
  }

  const deviceOperator = new DeviceOperator();
  const azureOperator = new AzureOperator();

  const exampleExplorer = new exampleExplorerModule.ExampleExplorer();
  const exampleSelectBoardBinder =
      exampleExplorer.selectBoard.bind(exampleExplorer);
  const initializeExampleBinder =
      exampleExplorer.initializeExample.bind(exampleExplorer);

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json

  const projectInitProvider = async () => {
    // Initialize Telemetry
    if (!telemetryWorkerInitialized) {
      telemetryModule.TelemetryWorker.Initialize(context);
      telemetryWorkerInitialized = true;
    }

    const projectInitializer = new ProjectInitializer();
    const projectInitializerBinder =
        projectInitializer.InitializeProject.bind(projectInitializer);
    telemetryModule.callWithTelemetry(
        EventNames.createNewProjectEvent, outputChannel, true, context,
        projectInitializerBinder);
  };

  const azureProvisionProvider = async () => {
    // Initialize Telemetry
    if (!telemetryWorkerInitialized) {
      telemetryModule.TelemetryWorker.Initialize(context);
      telemetryWorkerInitialized = true;
    }

    telemetryModule.callWithTelemetry(
        EventNames.azureProvisionEvent, outputChannel, true, context,
        azureOperator.Provision);
  };

  const azureDeployProvider = async () => {
    // Initialize Telemetry
    if (!telemetryWorkerInitialized) {
      telemetryModule.TelemetryWorker.Initialize(context);
      telemetryWorkerInitialized = true;
    }

    telemetryModule.callWithTelemetry(
        EventNames.azureDeployEvent, outputChannel, true, context,
        azureOperator.Deploy);
  };

  const deviceCompileProvider = async () => {
    // Initialize Telemetry
    if (!telemetryWorkerInitialized) {
      telemetryModule.TelemetryWorker.Initialize(context);
      telemetryWorkerInitialized = true;
    }

    telemetryModule.callWithTelemetry(
        EventNames.deviceCompileEvent, outputChannel, true, context,
        deviceOperator.compile);
  };

  const deviceUploadProvider = async () => {
    // Initialize Telemetry
    if (!telemetryWorkerInitialized) {
      telemetryModule.TelemetryWorker.Initialize(context);
      telemetryWorkerInitialized = true;
    }

    telemetryModule.callWithTelemetry(
        EventNames.deviceUploadEvent, outputChannel, true, context,
        deviceOperator.upload);
  };

  const devicePackageManager = async () => {
    // Initialize Telemetry
    if (!telemetryWorkerInitialized) {
      telemetryModule.TelemetryWorker.Initialize(context);
      telemetryWorkerInitialized = true;
    }

    telemetryModule.callWithTelemetry(
        EventNames.devicePackageEvent, outputChannel, true, context,
        deviceOperator.downloadPackage);
  };

  const deviceSettingsConfigProvider = async () => {
    // Initialize Telemetry
    if (!telemetryWorkerInitialized) {
      telemetryModule.TelemetryWorker.Initialize(context);
      telemetryWorkerInitialized = true;
    }

    telemetryModule.callWithTelemetry(
        EventNames.configDeviceSettingsEvent, outputChannel, true, context,
        deviceOperator.configDeviceSettings);
  };

  const examplesProvider = async () => {
    // Initialize Telemetry
    if (!telemetryWorkerInitialized) {
      telemetryModule.TelemetryWorker.Initialize(context);
      telemetryWorkerInitialized = true;
    }

    telemetryModule.callWithTelemetry(
        EventNames.openExamplePageEvent, outputChannel, true, context,
        exampleSelectBoardBinder);
  };

  const examplesInitializeProvider =
      async (name?: string, url?: string, boardId?: string) => {
    // Initialize Telemetry
    if (!telemetryWorkerInitialized) {
      telemetryModule.TelemetryWorker.Initialize(context);
      telemetryWorkerInitialized = true;
    }

    telemetryModule.callWithTelemetry(
        EventNames.loadExampleEvent, outputChannel, true, context,
        initializeExampleBinder, {}, name, url, boardId);
  };

  const projectInit = vscode.commands.registerCommand(
      'iotworkbench.initializeProject', projectInitProvider);

  const examples = vscode.commands.registerCommand(
      'iotworkbench.examples', examplesProvider);

  const exampleInitialize = vscode.commands.registerCommand(
      'iotworkbench.exampleInitialize', examplesInitializeProvider);

  const deviceCompile = vscode.commands.registerCommand(
      'iotworkbench.deviceCompile', deviceCompileProvider);

  const deviceUpload = vscode.commands.registerCommand(
      'iotworkbench.deviceUpload', deviceUploadProvider);

  const azureProvision = vscode.commands.registerCommand(
      'iotworkbench.azureProvision', azureProvisionProvider);

  const azureDeploy = vscode.commands.registerCommand(
      'iotworkbench.azureDeploy', azureDeployProvider);

  const deviceToolchain = vscode.commands.registerCommand(
      'iotworkbench.installToolchain', devicePackageManager);

  const configureDevice = vscode.commands.registerCommand(
      'iotworkbench.configureDevice', deviceSettingsConfigProvider);

  const sendTelemetry = vscode.commands.registerCommand(
      'iotworkbench.sendTelemetry',
      (additionalProperties: {[key: string]: string}) => {
        const properties: TelemetryProperties = {
          result: 'Succeeded',
          error: '',
          errorMessage: ''
        };

        for (const key of Object.keys(additionalProperties)) {
          properties[key] = additionalProperties[key];
        }

        const telemetryContext:
            TelemetryContext = {properties, measurements: {duration: 0}};


        // Initialize Telemetry
        if (!telemetryWorkerInitialized) {
          telemetryModule.TelemetryWorker.Initialize(context);
          telemetryWorkerInitialized = true;
        }
        telemetryModule.TelemetryWorker.sendEvent(
            EventNames.openTutorial, telemetryContext);
      });

  const openUri =
      vscode.commands.registerCommand('iotworkbench.openUri', (uri: string) => {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(uri));
      });

  const httpRequest = vscode.commands.registerCommand(
      'iotworkbench.httpRequest', async (uri: string) => {
        const res = await request(uri);
        return res;
      });

  const helpProvider = new VSCExpress(context, 'views');

  const helpInit =
      vscode.commands.registerCommand('iotworkbench.help', async () => {
        const boardId = ConfigHandler.get<string>(ConfigKey.boardId);

        if (boardId) {
          const platformFolder = platformFolderMap.get(PlatformType.ARDUINO);
          if (platformFolder === undefined) {
            throw new Error(`Platform ${
                PlatformType.ARDUINO}'s  resource folder does not exist.`);
          }
          const boardFolderPath = context.asAbsolutePath(
              path.join(FileNames.resourcesFolderName, platformFolder));
          const boardProvider = new BoardProvider(boardFolderPath);
          const board = boardProvider.find({id: boardId});

          if (board && board.helpUrl) {
            await vscode.commands.executeCommand(
                'vscode.open', vscode.Uri.parse(board.helpUrl));
            return;
          }
        }
        helpProvider.open(
            'help.html', 'Welcome - Azure IoT Device Workbench',
            vscode.ViewColumn.One, {
              enableScripts: true,
              enableCommandUris: true,
              retainContextWhenHidden: true
            });
        return;
      });

  const workbenchPath =
      vscode.commands.registerCommand('iotworkbench.workbench', async () => {
        const settings: IoTWorkbenchSettings =
            await IoTWorkbenchSettings.createAsync();
        await settings.setWorkbenchPath();
        return;
      });

  const getDisableAutoPopupLandingPage = vscode.commands.registerCommand(
      'iotworkbench.getDisableAutoPopupLandingPage', () => {
        return ConfigHandler.get<boolean>('disableAutoPopupLandingPage');
      });

  const setDisableAutoPopupLandingPage = vscode.commands.registerCommand(
      'iotworkbench.setDisableAutoPopupLandingPage',
      async (disableAutoPopupLandingPage: boolean) => {
        return ConfigHandler.update(
            'disableAutoPopupLandingPage', disableAutoPopupLandingPage,
            vscode.ConfigurationTarget.Global);
      });

  context.subscriptions.push(projectInit);
  context.subscriptions.push(examples);
  context.subscriptions.push(exampleInitialize);
  context.subscriptions.push(helpInit);
  context.subscriptions.push(workbenchPath);
  context.subscriptions.push(deviceCompile);
  context.subscriptions.push(deviceUpload);
  context.subscriptions.push(azureProvision);
  context.subscriptions.push(azureDeploy);
  context.subscriptions.push(deviceToolchain);
  context.subscriptions.push(configureDevice);
  context.subscriptions.push(sendTelemetry);
  context.subscriptions.push(openUri);
  context.subscriptions.push(httpRequest);
  context.subscriptions.push(getDisableAutoPopupLandingPage);
  context.subscriptions.push(setDisableAutoPopupLandingPage);

  const shownHelpPage = ConfigHandler.get<boolean>(ConfigKey.shownHelpPage);
  if (!shownHelpPage) {
    const iotTools =
        vscode.extensions.getExtension('vsciot-vscode.azure-iot-tools');
    // If Azure IoT Tools has been installed, do not open help page
    if (iotTools) {
      return;
    }
    // Do not execute help command here
    // Help command may open board help link
    helpProvider.open(
        'help.html', 'Welcome - Azure IoT Device Workbench',
        vscode.ViewColumn.One);

    ConfigHandler.update(
        ConfigKey.shownHelpPage, true, vscode.ConfigurationTarget.Global);
  }

  setTimeout(() => {
    // delay to detect usb
    const usbDetector =
        new usbDetectorModule.UsbDetector(context, outputChannel);
    usbDetector.startListening();
  }, 200);
}

// this method is called when your extension is deactivated
export async function deactivate() {
  if (telemetryWorkerInitialized) {
    await telemetryModule.TelemetryWorker.dispose();
  }
}