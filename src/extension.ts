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
import {ConfigKey, EventNames, FileNames} from './constants';
import {TelemetryContext, TelemetryProperties} from './telemetry';
import {ProjectHostType} from './Models/Interfaces/ProjectHostType';
import {RemoteExtension} from './Models/RemoteExtension';

const impor = require('impor')(__dirname);
const exampleExplorerModule =
    impor('./exampleExplorer') as typeof import('./exampleExplorer');

import {IoTWorkbenchProjectBase} from './Models/IoTWorkbenchProjectBase';
import {FileUtility} from './FileUtility';
const ioTWorkspaceProjectModule = impor('./Models/IoTWorkspaceProject') as
    typeof import('./Models/IoTWorkspaceProject');
const ioTContainerizedProjectModule =
    impor('./Models/IoTContainerizedProject') as
    typeof import('./Models/IoTContainerizedProject');
const telemetryModule = impor('./telemetry') as typeof import('./telemetry');
const request = impor('request-promise') as typeof import('request-promise');

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

  let projectHostType: ProjectHostType = ProjectHostType.Unknown;
  if (vscode.workspace.workspaceFolders) {
    try {
      // Initialize Telemetry
      if (!telemetryWorkerInitialized) {
        telemetryModule.TelemetryWorker.Initialize(context);
        telemetryWorkerInitialized = true;
      }

      const projectFileRootPath =
          vscode.workspace.workspaceFolders[0].uri.fsPath;
      projectHostType =
          IoTWorkbenchProjectBase.GetProjectType(projectFileRootPath);
      let iotProject;
      if (projectHostType === ProjectHostType.Container) {
        iotProject = new ioTContainerizedProjectModule.IoTContainerizedProject(
            context, outputChannel, telemetryContext);
      } else if (projectHostType === ProjectHostType.Workspace) {
        iotProject = new ioTWorkspaceProjectModule.IoTWorkspaceProject(
            context, outputChannel, telemetryContext);
      }
      if (iotProject !== undefined) {
        await iotProject.load(true);
      }
    } catch (error) {
      // do nothing as we are not sure whether the project is initialized.
    }
  }

  const deviceOperator = new DeviceOperator(projectHostType);
  const azureOperator = new AzureOperator(projectHostType);

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

    const azureProvisionBinder = azureOperator.Provision.bind(azureOperator);
    telemetryModule.callWithTelemetry(
        EventNames.azureProvisionEvent, outputChannel, true, context,
        azureProvisionBinder);
  };

  const azureDeployProvider = async () => {
    // Initialize Telemetry
    if (!telemetryWorkerInitialized) {
      telemetryModule.TelemetryWorker.Initialize(context);
      telemetryWorkerInitialized = true;
    }

    const azureDeployBinder = azureOperator.Deploy.bind(azureOperator);
    telemetryModule.callWithTelemetry(
        EventNames.azureDeployEvent, outputChannel, true, context,
        azureDeployBinder);
  };

  const deviceCompileProvider = async () => {
    // Initialize Telemetry
    if (!telemetryWorkerInitialized) {
      telemetryModule.TelemetryWorker.Initialize(context);
      telemetryWorkerInitialized = true;
    }

    const deviceCompileBinder = deviceOperator.compile.bind(deviceOperator);
    telemetryModule.callWithTelemetry(
        EventNames.deviceCompileEvent, outputChannel, true, context,
        deviceCompileBinder);
  };

  const deviceUploadProvider = async () => {
    // Initialize Telemetry
    if (!telemetryWorkerInitialized) {
      telemetryModule.TelemetryWorker.Initialize(context);
      telemetryWorkerInitialized = true;
    }

    const deviceUploadBinder = deviceOperator.upload.bind(deviceOperator);
    telemetryModule.callWithTelemetry(
        EventNames.deviceUploadEvent, outputChannel, true, context,
        deviceUploadBinder);
  };

  const deviceSettingsConfigProvider = async () => {
    // Initialize Telemetry
    if (!telemetryWorkerInitialized) {
      telemetryModule.TelemetryWorker.Initialize(context);
      telemetryWorkerInitialized = true;
    }

    const deviceConfigBinder =
        deviceOperator.configDeviceSettings.bind(deviceOperator);
    telemetryModule.callWithTelemetry(
        EventNames.configDeviceSettingsEvent, outputChannel, true, context,
        deviceConfigBinder);
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
          const boardListFolderPath = context.asAbsolutePath(path.join(
              FileNames.resourcesFolderName, FileNames.templatesFolderName));
          const boardProvider = new BoardProvider(boardListFolderPath);
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
        if (RemoteExtension.isRemote(context)) {
          const message =
              `You are in a container now. Setting project default path is currently not supported inside the container. You can do it in a new window(click 'File -> New Window').`;
          vscode.window.showWarningMessage(message);
          return;
        }
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
    if (RemoteExtension.isRemote(context)) {
      return;
    }
    // delay to detect usb
    const usbDetectorModule =
        impor('./usbDetector') as typeof import('./usbDetector');

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