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
import {AzureFunction} from './Models/AzureFunction';

const constants = {
  configFileName: 'iotstudio.config.json'
};


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors
  // (console.error) This line of code will only be executed once when your
  // extension is activated
  console.log(
      'Congratulations, your extension "vscode-azure-iot-studio" is now active!');

  const outputChannel: vscode.OutputChannel =
      vscode.window.createOutputChannel('Azure IoT Studio');

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

  const projectInit = vscode.commands.registerCommand(
      'azureiotstudio.initializeProject', async () => {
        try {
          await projectInitializer.InitializeProject(context, outputChannel);
        } catch (error) {
          ExceptionHelper.logError(outputChannel, error, true);
        }
      });

  const azureProvision = vscode.commands.registerCommand(
      'azureiotstudio.azureProvision', async () => {
        try {
          await azureOperator.Provision(context, outputChannel);
          vscode.window.showInformationMessage('Azure provision succeeded.');
        } catch (error) {
          ExceptionHelper.logError(outputChannel, error, true);
        }
      });

  const azureDeploy = vscode.commands.registerCommand(
      'azureiotstudio.azureDeploy', async () => {
        try {
          await azureOperator.Deploy(context, outputChannel);
        } catch (error) {
          ExceptionHelper.logError(outputChannel, error, true);
        }
      });

  const deviceCompile = vscode.commands.registerCommand(
      'azureiotstudio.deviceCompile', async () => {
        try {
          await deviceOperator.compile(context, outputChannel);
        } catch (error) {
          ExceptionHelper.logError(outputChannel, error, true);
        }
      });

  const deviceUpload = vscode.commands.registerCommand(
      'azureiotstudio.deviceUpload', async () => {
        try {
          await deviceOperator.upload(context, outputChannel);
        } catch (error) {
          ExceptionHelper.logError(outputChannel, error, true);
        }
      });

  const deviceConnectionStringConfig = vscode.commands.registerCommand(
      'azureiotstudio.deviceConnectionStringConfig', async () => {
        try {
          await deviceOperator.setConnectionString(context, outputChannel);
        } catch (error) {
          ExceptionHelper.logError(outputChannel, error, true);
        }
      });

  const examples =
      vscode.commands.registerCommand('azureiotstudio.examples', async () => {
        try {
          const res =
              await exampleExplorer.initializeExample(context, outputChannel);
          vscode.window.showInformationMessage(
              res ? 'Example loaded.' : 'Example load failed.');
        } catch (error) {
          ExceptionHelper.logError(outputChannel, error, true);
        }
      });

  const functionInit = vscode.commands.registerCommand(
      'azureiotstudio.initializeFunction', async () => {
        try {
          const azureFunctionPath =
              vscode.workspace.getConfiguration('IoTStudio')
                  .get<string>('FunctionPath');
          if (!azureFunctionPath) {
            throw new Error('Get workspace configure file failed.');
          }
          console.log(azureFunctionPath);
          const azureFunction =
              new AzureFunction(azureFunctionPath, outputChannel);
          const res = await azureFunction.initialize();
          vscode.window.showInformationMessage(
              res ? 'Function created.' : 'Function create failed.');
        } catch (error) {
          ExceptionHelper.logError(outputChannel, error, true);
        }
      });

  context.subscriptions.push(projectInit);
  context.subscriptions.push(azureProvision);
  context.subscriptions.push(azureDeploy);
  context.subscriptions.push(deviceCompile);
  context.subscriptions.push(deviceUpload);
  context.subscriptions.push(deviceConnectionStringConfig);
  context.subscriptions.push(examples);
  context.subscriptions.push(functionInit);
}

// this method is called when your extension is deactivated
export function deactivate() {}