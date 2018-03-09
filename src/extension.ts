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
import {AzureFunction} from './Models/AzureFunction';
import {CommandItem} from './Models/Interfaces/CommandItem';

async function renderMenu(
    parentLabel: string, commands: CommandItem[]|undefined) {
  if (commands === undefined) {
    return;
  }
  const selection = await vscode.window.showQuickPick(
      commands, {ignoreFocusOut: true, placeHolder: parentLabel});
  if (!selection) {
    return;
  }

  for (let i = 0; i < commands.length; i++) {
    if (commands[i].label === selection.label &&
        commands[i].description === selection.description) {
      if (commands[i].onClick !== undefined) {
        executeCommand(commands[i].onClick);
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

  const iotProject = new IoTProject(context, outputChannel);
  if (vscode.workspace.workspaceFolders) {
    try {
      await iotProject.load();
    } catch (error) {
      // do nothing as we are not sure whether the project is initialized.
    }
  }

  const projectInitializer = new ProjectInitializer();
  const deviceOperator = new DeviceOperator();
  const azureOperator = new AzureOperator();
  const exampleExplorer = new ExampleExplorer();

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json

  const projectInitProvider = async () => {
    try {
      await projectInitializer.InitializeProject(context, outputChannel);
    } catch (error) {
      ExceptionHelper.logError(outputChannel, error, true);
    }
  };

  const azureProvisionProvider = async () => {
    try {
      const status = await azureOperator.Provision(context, outputChannel);
      if (status) {
        vscode.window.showInformationMessage('Azure provision succeeded.');
      }
    } catch (error) {
      ExceptionHelper.logError(outputChannel, error, true);
    }
  };

  const azureDeployProvider = async () => {
    try {
      await azureOperator.Deploy(context, outputChannel);
    } catch (error) {
      ExceptionHelper.logError(outputChannel, error, true);
    }
  };

  const deviceCompileProvider = async () => {
    try {
      await deviceOperator.compile(context, outputChannel);
    } catch (error) {
      ExceptionHelper.logError(outputChannel, error, true);
    }
  };

  const deviceUploadProvider = async () => {
    try {
      await deviceOperator.upload(context, outputChannel);
    } catch (error) {
      ExceptionHelper.logError(outputChannel, error, true);
    }
  };

  const deviceConnectionStringConfigProvider = async () => {
    try {
      await deviceOperator.setConnectionString(context, outputChannel);
    } catch (error) {
      ExceptionHelper.logError(outputChannel, error, true);
    }
  };

  const examplesProvider = async () => {
    try {
      const res =
          await exampleExplorer.initializeExample(context, outputChannel);

      if (res) {
        vscode.window.showInformationMessage('Example load successfully.');
      } else {
        vscode.window.showErrorMessage(
            'Unable to load example. Please check output window for detailed information.');
      }
    } catch (error) {
      ExceptionHelper.logError(outputChannel, error, true);
    }
  };

  const functionInitProvider = async () => {
    try {
      if (!vscode.workspace.workspaceFolders) {
        throw new Error('No workspace open.');
      }

      const azureFunctionPath =
          vscode.workspace.getConfiguration('IoTWorkbench')
              .get<string>('FunctionPath');
      if (!azureFunctionPath) {
        throw new Error('Get workspace configure file failed.');
      }

      const functionLocation = path.join(
          vscode.workspace.workspaceFolders[0].uri.fsPath, '..',
          azureFunctionPath);
      console.log(functionLocation);

      const azureFunction = new AzureFunction(functionLocation, outputChannel);
      const res = await azureFunction.initialize();
      vscode.window.showInformationMessage(
          res ? 'Function created.' : 'Function create failed.');
    } catch (error) {
      ExceptionHelper.logError(outputChannel, error, true);
    }
  };

  const menuForDevice: CommandItem[] = [
    {
      label: 'Config Device Connection String',
      description: '',
      detail: 'Set connection string on device to connection to Azure',
      onClick: deviceConnectionStringConfigProvider
    },
    {
      label: 'Device Compile',
      description: '',
      detail: 'Compile device side code',
      onClick: deviceCompileProvider
    },
    {
      label: 'Device Upload',
      description: '',
      detail: 'Upload code to device',
      onClick: deviceUploadProvider
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
          onClick: projectInitProvider
        },
        {
          label: 'Example Projects',
          description: '',
          detail: 'Load an example project',
          onClick: examplesProvider
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
          onClick: azureProvisionProvider
        },
        {
          label: 'Azure Deploy',
          description: '',
          detail: 'Deploy local code to Azure',
          onClick: azureDeployProvider
        },
        {
          label: 'Create Function',
          description: '',
          detail: 'Generate Azure Function code in local',
          onClick: functionInitProvider
        }
      ]
    }
  ];

  const iotdevMenu =
      vscode.commands.registerCommand('iotworkbench.mainMenu', async () => {
        renderMenu('IoT Workbench Project', menu);
      });

  const iotdeviceMenu =
      vscode.commands.registerCommand('iotworkbench.device', async () => {
        renderMenu('IoT Workbench: Device', menuForDevice);
      });

  const projectInit = vscode.commands.registerCommand(
      'iotworkbench.initializeProject', projectInitProvider);

  const azureProvision = vscode.commands.registerCommand(
      'iotworkbench.azureProvision', azureProvisionProvider);

  const azureDeploy = vscode.commands.registerCommand(
      'iotworkbench.azureDeploy', azureDeployProvider);

  const examples = vscode.commands.registerCommand(
      'iotworkbench.examples', examplesProvider);

  const functionInit = vscode.commands.registerCommand(
      'iotworkbench.initializeFunction', functionInitProvider);

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

  context.subscriptions.push(iotdevMenu);
  context.subscriptions.push(iotdeviceMenu);
  context.subscriptions.push(projectInit);
  context.subscriptions.push(azureProvision);
  context.subscriptions.push(azureDeploy);
  context.subscriptions.push(examples);
  context.subscriptions.push(functionInit);
  context.subscriptions.push(helpInit);
  context.subscriptions.push(workbenchPath);
}

// this method is called when your extension is deactivated
export function deactivate() {}