// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import {FileNames, PlatformType} from './constants';
import {VSCExpress} from 'vscode-express';
import {BoardProvider} from './boardProvider';
import {ProjectInitializer} from './projectInitializer';
import {LibraryManager} from './libraryManager';
import {DeviceOperator} from './DeviceOperator';
import {AzureOperator} from './AzureOperator';
import {ExampleExplorer} from './exampleExplorer';
import {IoTWorkbenchSettings} from './IoTSettings';
import {ConfigHandler} from './configHandler';
import {ConfigKey, EventNames} from './constants';
import {TelemetryContext, callWithTelemetry, TelemetryWorker, TelemetryProperties} from './telemetry';
import {UsbDetector} from './usbDetector';

const impor = require('impor')(__dirname);
const ioTProjectModule =
    impor('./Models/IoTProject') as typeof import('./Models/IoTProject');
const request = impor('request-promise') as typeof import('request-promise');

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

  // Initialize Telemetry
  TelemetryWorker.Initialize(context);

  const telemetryContext: TelemetryContext = {
    properties: {result: 'Succeeded', error: '', errorMessage: ''},
    measurements: {duration: 0}
  };
  const iotProject =
      new ioTProjectModule.IoTProject(context, outputChannel, telemetryContext);
  if (vscode.workspace.workspaceFolders) {
    try {
      await iotProject.load(true);
    } catch (error) {
      // do nothing as we are not sure whether the project is initialized.
    }
  }

  const projectInitializer = new ProjectInitializer();
  const projectInitializerBinder =
      projectInitializer.InitializeProject.bind(projectInitializer);

  const deviceOperator = new DeviceOperator();
  const azureOperator = new AzureOperator();

  const exampleExplorer = new ExampleExplorer();
  const exampleSelectBoardBinder =
      exampleExplorer.selectBoard.bind(exampleExplorer);
  const initializeExampleBinder =
      exampleExplorer.initializeExample.bind(exampleExplorer);

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json

  const projectInitProvider = async () => {
    callWithTelemetry(
        EventNames.createNewProjectEvent, outputChannel, true, context,
        projectInitializerBinder);
  };

  const libraryManageProvider = async () => {
    callWithTelemetry(
        EventNames.manageLibraryEvent, outputChannel, true, context,
        deviceOperator.manageLibrary);
  };

  const azureProvisionProvider = async () => {
    callWithTelemetry(
        EventNames.azureProvisionEvent, outputChannel, true, context,
        azureOperator.Provision);
  };

  const azureDeployProvider = async () => {
    callWithTelemetry(
        EventNames.azureDeployEvent, outputChannel, true, context,
        azureOperator.Deploy);
  };

  const deviceCompileProvider = async () => {
    callWithTelemetry(
        EventNames.deviceCompileEvent, outputChannel, true, context,
        deviceOperator.compile);
  };

  const deviceUploadProvider = async () => {
    callWithTelemetry(
        EventNames.deviceUploadEvent, outputChannel, true, context,
        deviceOperator.upload);
  };

  const devicePackageManager = async () => {
    callWithTelemetry(
        EventNames.devicePackageEvent, outputChannel, true, context,
        deviceOperator.downloadPackage);
  };

  const deviceSettingsConfigProvider = async () => {
    callWithTelemetry(
        EventNames.configDeviceSettingsEvent, outputChannel, true, context,
        deviceOperator.configDeviceSettings);
  };

  const examplesProvider = async () => {
    callWithTelemetry(
        EventNames.openExamplePageEvent, outputChannel, true, context,
        exampleSelectBoardBinder);
  };

  const examplesInitializeProvider =
      async (name?: string, url?: string, boardId?: string) => {
    callWithTelemetry(
        EventNames.loadExampleEvent, outputChannel, true, context,
        initializeExampleBinder, {}, name, url, boardId);
  };

  const projectInit = vscode.commands.registerCommand(
      'iotworkbench.initializeProject', projectInitProvider);

  const libraryManage = vscode.commands.registerCommand(
      'iotworkbench.manageLibrary', libraryManageProvider);

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

        TelemetryWorker.sendEvent(EventNames.openTutorial, telemetryContext);
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
          const boardFolderPath = context.asAbsolutePath(
              path.join(FileNames.resourcesFolderName, PlatformType.ARDUINO));
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
        const settings = new IoTWorkbenchSettings();
        await settings.setWorkbenchPath();
        return;
      });

  context.subscriptions.push(projectInit);
  context.subscriptions.push(examples);
  context.subscriptions.push(exampleInitialize);
  context.subscriptions.push(helpInit);
  context.subscriptions.push(workbenchPath);
  context.subscriptions.push(deviceCompile);
  context.subscriptions.push(deviceUpload);
  context.subscriptions.push(libraryManage);
  context.subscriptions.push(azureProvision);
  context.subscriptions.push(azureDeploy);
  context.subscriptions.push(deviceToolchain);
  context.subscriptions.push(configureDevice);
  context.subscriptions.push(sendTelemetry);
  context.subscriptions.push(openUri);
  context.subscriptions.push(httpRequest);

  const usbDetector = new UsbDetector(context, outputChannel);
  usbDetector.startListening();

  const shownHelpPage = ConfigHandler.get<boolean>(ConfigKey.shownHelpPage);
  if (!shownHelpPage) {
    // Do not execute help command here
    // Help command may open board help link
    helpProvider.open(
        'help.html', 'Welcome - Azure IoT Device Workbench',
        vscode.ViewColumn.One);

    ConfigHandler.update(
        ConfigKey.shownHelpPage, true, vscode.ConfigurationTarget.Global);
  }
}

// this method is called when your extension is deactivated
export async function deactivate() {
  await TelemetryWorker.dispose();
}