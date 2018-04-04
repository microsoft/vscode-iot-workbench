// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';
import {ProjectInitializer} from './projectInitializer';
import {DeviceOperator} from './DeviceOperator';
import {AzureOperator} from './AzureOperator';
import {IoTProject} from './Models/IoTProject';
import {ExceptionHelper} from './exceptionHelper';
import {setTimeout} from 'timers';
import {ExampleExplorer} from './exampleExplorer';
import {IoTWorkbenchSettings} from './IoTSettings';
import {AzureFunctions} from './Models/AzureFunctions';
import {CommandItem} from './Models/Interfaces/CommandItem';
import {ConfigHandler} from './configHandler';
import {ConfigKey, EventNames, ContentView} from './constants';
import {ContentProvider} from './contentProvider';
import {TelemetryContext, callWithTelemetry, TelemetryWorker} from './telemetry';

function filterMenu(commands: CommandItem[]) {
  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    let filtered = false;
    if (command.only) {
      const hasRequiredConfig = ConfigHandler.get(command.only);
      if (!hasRequiredConfig) {
        commands.splice(i, 1);
        i--;
        filtered = true;
      }
    }

    if (!filtered && command.children) {
      command.children = filterMenu(command.children);
    }
  }
  return commands;
}

async function renderMenu(
    parentLabel: string, commands: CommandItem[]|undefined) {
  if (commands === undefined) {
    return;
  }

  commands = filterMenu(commands);

  const selection = await vscode.window.showQuickPick(
      commands, {ignoreFocusOut: true, placeHolder: parentLabel});
  if (!selection) {
    return;
  }

  for (let i = 0; i < commands.length; i++) {
    if (commands[i].label === selection.label &&
        commands[i].description === selection.description) {
      if (commands[i].click !== undefined) {
        executeCommand(commands[i].click);
      } else if (commands[i].children !== undefined) {
        renderMenu(commands[i].label, commands[i].children);
      }
      return;
    }
  }
}

// tslint:disable-next-line: no-any
function executeCommand(command: ((...args: any[]) => any)|undefined) {
  if (command === undefined) {
    return;
  }
  command();
}


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors
  // (console.error) This line of code will only be executed once when your
  // extension is activated
  console.log(
      'Congratulations, your extension "vscode-iot-workbench" is now active!');

  const outputChannel: vscode.OutputChannel =
      vscode.window.createOutputChannel('Azure IoT Workbench');

  // Initialize Telemetry
  TelemetryWorker.Initialize(context);

  const iotProject = new IoTProject(context, outputChannel);
  if (vscode.workspace.workspaceFolders) {
    try {
      await iotProject.load();
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


  const contentProvider =
      new ContentProvider(context.extensionPath, exampleExplorer);
  context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(
          ContentView.workbenchContentProtocol, contentProvider));

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json

  const projectInitProvider = async () => {
    callWithTelemetry(
        EventNames.createNewProjectEvent, outputChannel, context,
        projectInitializerBinder);
  };

  const azureProvisionProvider = async () => {
    callWithTelemetry(
        EventNames.azureProvisionEvent, outputChannel, context,
        azureOperator.Provision);
  };

  const azureDeployProvider = async () => {
    callWithTelemetry(
        EventNames.azureDeployEvent, outputChannel, context,
        azureOperator.Deploy);
  };

  const deviceCompileProvider = async () => {
    callWithTelemetry(
        EventNames.deviceCompileEvent, outputChannel, context,
        deviceOperator.compile);
  };

  const deviceUploadProvider = async () => {
    callWithTelemetry(
        EventNames.deviceUploadEvent, outputChannel, context,
        deviceOperator.upload);
  };

  const deviceConnectionStringConfigProvider = async () => {
    callWithTelemetry(
        EventNames.setDeviceConnectionStringEvent, outputChannel, context,
        deviceOperator.setConnectionString);
  };

  const examplesProvider = async () => {
    callWithTelemetry(
        EventNames.loadExampleEvent, outputChannel, context,
        exampleSelectBoardBinder);
  };

  const examplesInitializeProvider = async () => {
    callWithTelemetry(
        EventNames.loadExampleEvent, outputChannel, context,
        initializeExampleBinder);
  };

  const functionInitProvider = async () => {
    callWithTelemetry(
        EventNames.createAzureFunctionsEvent, outputChannel, context,
        azureOperator.createFunction);
  };

  const menuForDevice: CommandItem[] = [
    {
      label: 'Config Device Connection String',
      description: '',
      detail: 'Set connection string on device to connection to Azure',
      click: deviceConnectionStringConfigProvider
    },
    {
      label: 'Device Compile',
      description: '',
      detail: 'Compile device side code',
      click: deviceCompileProvider
    },
    {
      label: 'Device Upload',
      description: '',
      detail: 'Upload code to device',
      click: deviceUploadProvider
    }
  ];

  const menuForCloud: CommandItem[] = [
    {
      label: 'Azure Provision',
      description: '',
      detail: 'Provision Azure services',
      click: azureProvisionProvider
    },
    {
      label: 'Create Azure Functions',
      description: '',
      detail: 'Generate Azure Functions code in local',
      only: ConfigKey.functionPath,
      click: functionInitProvider
    },
    {
      label: 'Azure Deploy',
      description: '',
      detail: 'Deploy Azure Functions code to Azure',
      only: ConfigKey.functionPath,
      click: azureDeployProvider
    }
  ];

  const menu: CommandItem[] = [
    {
      label: 'Project Setup',
      description: '',
      detail: 'Start from here',
      children: [
        {
          label: 'Initialize Project',
          description: '',
          detail: 'Create a new project',
          click: projectInitProvider
        },
        {
          label: 'Example Projects',
          description: '',
          detail: 'Load an example project',
          click: examplesProvider
        }
      ]
    },
    {
      label: 'Develop for Azure',
      description: '',
      detail: 'Development on cloud side',
      children: [
        {
          label: 'Azure Provision',
          description: '',
          detail: 'Setup cloud services on Azure',
          click: azureProvisionProvider
        },
        {
          label: 'Azure Deploy',
          description: '',
          detail: 'Deploy local code to Azure',
          click: azureDeployProvider
        },
        {
          label: 'Create Function',
          description: '',
          detail: 'Generate Azure Function code in local',
          click: functionInitProvider
        }
      ]
    }
  ];

  const iotdeviceMenu =
      vscode.commands.registerCommand('iotworkbench.device', async () => {
        renderMenu('IoT Workbench: Device', menuForDevice);
      });

  const iotcloudMenu =
      vscode.commands.registerCommand('iotworkbench.cloud', async () => {
        renderMenu('IoT Workbench: Cloud', menuForCloud);
      });

  const projectInit = vscode.commands.registerCommand(
      'iotworkbench.initializeProject', projectInitProvider);

  const examples = vscode.commands.registerCommand(
      'iotworkbench.examples', examplesProvider);

  const exampleInitialize = vscode.commands.registerCommand(
      'iotworkbench.exampleInitialize', examplesInitializeProvider);

  const helpInit = vscode.commands.registerCommand('iotworkbench.help', async () => {
    await vscode.commands.executeCommand(
        'vscode.open',
        vscode.Uri.parse(
            'https://microsoft.github.io/azure-iot-developer-kit/docs/get-started/'));
    return;
  });

  const workbenchPath =
      vscode.commands.registerCommand('iotworkbench.workbench', async () => {
        const settings = new IoTWorkbenchSettings();
        await settings.setWorkbenchPath();
        return;
      });

  context.subscriptions.push(iotdeviceMenu);
  context.subscriptions.push(iotcloudMenu);
  context.subscriptions.push(projectInit);
  context.subscriptions.push(examples);
  context.subscriptions.push(helpInit);
  context.subscriptions.push(workbenchPath);
}

// this method is called when your extension is deactivated
export function deactivate() {}