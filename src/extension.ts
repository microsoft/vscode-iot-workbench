// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import {BoardProvider} from './boardProvider';
import {ProjectInitializer} from './projectInitializer';
import {DeviceOperator} from './DeviceOperator';
import {AzureOperator} from './AzureOperator';
import {IoTWorkbenchSettings} from './IoTSettings';
import {ConfigHandler} from './configHandler';
import {CodeGeneratorCore} from './DigitalTwin/CodeGeneratorCore';
import {ConfigKey, EventNames, FileNames} from './constants';
import {TelemetryContext, TelemetryWorker} from './telemetry';
import {RemoteExtension} from './Models/RemoteExtension';
import {constructAndLoadIoTProject} from './utils';
import {ProjectEnvironmentConfiger} from './ProjectEnvironmentConfiger';
import {WorkbenchExtension} from './WorkbenchExtension';
import {WorkbenchCommands, VscodeCommands} from './common/Commands';

const impor = require('impor')(__dirname);
const exampleExplorerModule =
    impor('./exampleExplorer') as typeof import('./exampleExplorer');
const request = impor('request-promise') as typeof import('request-promise');

// tslint:disable-next-line:no-any
let telemetryWorker: any = undefined;

export async function activate(context: vscode.ExtensionContext) {
  printHello(context);

  const channelName = 'Azure IoT Device Workbench';
  const outputChannel: vscode.OutputChannel =
      vscode.window.createOutputChannel(channelName);
  telemetryWorker = TelemetryWorker.getInstance(context);
  const telemetryContext = telemetryWorker.createContext();
  context.subscriptions.push(telemetryWorker);

  // Load iot Project here and do not ask to new an iot project when no iot
  // project open since no command has been triggered yet.
  await constructAndLoadIoTProject(
      context, outputChannel, telemetryContext, true);

  const deviceOperator = new DeviceOperator();
  const azureOperator = new AzureOperator();
  const exampleExplorer = new exampleExplorerModule.ExampleExplorer();

  initCommandWithTelemetry(
      context, telemetryWorker, telemetryContext, outputChannel,
      WorkbenchCommands.InitializeProject, EventNames.createNewProjectEvent,
      true, async(): Promise<void> => {
        const projectInitializer = new ProjectInitializer();
        return projectInitializer.InitializeProject(
            context, outputChannel, telemetryContext);
      });

  initCommandWithTelemetry(
      context, telemetryWorker, telemetryContext, outputChannel,
      WorkbenchCommands.ConfigureProjectEnvironment,
      EventNames.configProjectEnvironmentEvent, true,
      async(): Promise<void> => {
        const projectEnvConfiger = new ProjectEnvironmentConfiger();
        return projectEnvConfiger.configureCmakeProjectEnvironment(
            context, outputChannel, telemetryContext);
      });

  initCommandWithTelemetry(
      context, telemetryWorker, telemetryContext, outputChannel,
      WorkbenchCommands.AzureProvision, EventNames.azureProvisionEvent, true,
      async(): Promise<void> => {
        return azureOperator.provision(
            context, outputChannel, telemetryContext);
      });

  initCommandWithTelemetry(
      context, telemetryWorker, telemetryContext, outputChannel,
      WorkbenchCommands.AzureDeploy, EventNames.azureDeployEvent, true,
      async(): Promise<void> => {
        return azureOperator.deploy(context, outputChannel, telemetryContext);
      });

  initCommandWithTelemetry(
      context, telemetryWorker, telemetryContext, outputChannel,
      WorkbenchCommands.DeviceCompile, EventNames.deviceCompileEvent, true,
      async(): Promise<void> => {
        return deviceOperator.compile(context, outputChannel, telemetryContext);
      });

  initCommandWithTelemetry(
      context, telemetryWorker, telemetryContext, outputChannel,
      WorkbenchCommands.DeviceUpload, EventNames.deviceUploadEvent, true,
      async(): Promise<void> => {
        return deviceOperator.upload(context, outputChannel, telemetryContext);
      });

  initCommandWithTelemetry(
      context, telemetryWorker, telemetryContext, outputChannel,
      WorkbenchCommands.ConfigureDevice, EventNames.configDeviceSettingsEvent,
      true, async(): Promise<void> => {
        return deviceOperator.configDeviceSettings(
            context, outputChannel, telemetryContext);
      });

  initCommandWithTelemetry(
      context, telemetryWorker, telemetryContext, outputChannel,
      WorkbenchCommands.Examples, EventNames.openExamplePageEvent, true,
      async(): Promise<void> => {
        return exampleExplorer.selectBoard(
            context, outputChannel, telemetryContext);
      });

  initCommandWithTelemetry(
      context, telemetryWorker, telemetryContext, outputChannel,
      WorkbenchCommands.ExampleInitialize, EventNames.loadExampleEvent, true,
      async(
          context, outputChannel, telemetryContext, name?: string, url?: string,
          boardId?: string): Promise<void> => {
        return exampleExplorer.initializeExample(
            context, outputChannel, telemetryContext, name, url, boardId);
      });

  initCommandWithTelemetry(
      context, telemetryWorker, telemetryContext, outputChannel,
      WorkbenchCommands.SendTelemetry, EventNames.openTutorial, true,
      async () => {});

  initCommandWithTelemetry(
      context, telemetryWorker, telemetryContext, outputChannel,
      WorkbenchCommands.IotPnPGenerateCode, EventNames.scaffoldDeviceStubEvent,
      true, async(): Promise<void> => {
        const codeGenerator = new CodeGeneratorCore();
        return codeGenerator.generateDeviceCodeStub(
            context, outputChannel, telemetryContext);
      });

  initCommandWithTelemetry(
      context, telemetryWorker, telemetryContext, outputChannel,
      WorkbenchCommands.Help, EventNames.help, true, async () => {
        const boardId = ConfigHandler.get<string>(ConfigKey.boardId);

        if (boardId) {
          const boardListFolderPath = context.asAbsolutePath(path.join(
              FileNames.resourcesFolderName, FileNames.templatesFolderName));
          const boardProvider = new BoardProvider(boardListFolderPath);
          const board = boardProvider.find({id: boardId});

          if (board && board.helpUrl) {
            await vscode.commands.executeCommand(
                VscodeCommands.VscodeOpen, vscode.Uri.parse(board.helpUrl));
            return;
          }
        }
        const workbenchHelpUrl =
            'https://github.com/microsoft/vscode-iot-workbench/blob/master/README.md';
        await vscode.commands.executeCommand(
            VscodeCommands.VscodeOpen, vscode.Uri.parse(workbenchHelpUrl));
        return;
      });

  initCommandWithTelemetry(
      context, telemetryWorker, telemetryContext, outputChannel,
      WorkbenchCommands.Workbench, EventNames.setProjectDefaultPath, true,
      async () => {
        const isLocal = RemoteExtension.checkLocalBeforeRunCommand(context);
        if (!isLocal) {
          return;
        }
        const settings: IoTWorkbenchSettings =
            await IoTWorkbenchSettings.createAsync();
        await settings.setWorkbenchPath();
        return;
      });

  initCommand(context, WorkbenchCommands.OpenUri, async (uri: string) => {
    vscode.commands.executeCommand(
        VscodeCommands.VscodeOpen, vscode.Uri.parse(uri));
  });

  initCommand(context, WorkbenchCommands.HttpRequest, async (uri: string) => {
    const res = await request(uri);
    return res;
  });


  initCommand(
      context, WorkbenchCommands.GetDisableAutoPopupLandingPage, async () => {
        return ConfigHandler.get<boolean>(
            ConfigKey.disableAutoPopupLandingPage);
      });

  initCommand(
      context, WorkbenchCommands.SetDisableAutoPopupLandingPage,
      async (disableAutoPopupLandingPage: boolean) => {
        return ConfigHandler.update(
            ConfigKey.disableAutoPopupLandingPage, disableAutoPopupLandingPage,
            vscode.ConfigurationTarget.Global);
      });

  // delay to detect usb
  setTimeout(() => {
    enableUsbDetector(context, outputChannel);
  }, 200);
}

// this method is called when your extension is deactivated
export async function deactivate() {}

function enableUsbDetector(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel): void {
  if (RemoteExtension.isRemote(context)) {
    return;
  }
  // delay to detect usb
  const usbDetectorModule =
      impor('./usbDetector') as typeof import('./usbDetector');

  const usbDetector = new usbDetectorModule.UsbDetector(context, outputChannel);
  usbDetector.startListening();
}

function printHello(context: vscode.ExtensionContext) {
  const extension = WorkbenchExtension.getExtension(context);
  if (!extension) {
    return;
  }

  const extensionId = extension.id;
  console.log(`Congratulations, your extension ${extensionId} is now active!`);
}


function initCommandWithTelemetry(
    context: vscode.ExtensionContext, telemetryWorker: TelemetryWorker,
    telemetryContext: TelemetryContext, outputChannel: vscode.OutputChannel,
    command: WorkbenchCommands, eventName: string, enableSurvey: boolean,
    // tslint:disable-next-line:no-any
    callback: (
        context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel,
        // tslint:disable-next-line:no-any
        telemetrycontext: TelemetryContext, ...args: any[]) => any,
    // tslint:disable-next-line:no-any
    additionalProperties?: {[key: string]: string}): void {
  context.subscriptions.push(vscode.commands.registerCommand(
      command,
      async (...commandArgs) => telemetryWorker.callCommandWithTelemetry(
          context, telemetryContext, outputChannel, eventName, enableSurvey,
          callback, additionalProperties, ...commandArgs)));
}

function initCommand(
    context: vscode.ExtensionContext, command: WorkbenchCommands,
    // tslint:disable-next-line:no-any
    callback: (...args: any[]) => Promise<any>): void {
  context.subscriptions.push(
      vscode.commands.registerCommand(command, callback));
}