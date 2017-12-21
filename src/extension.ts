'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {ProjectInitializer} from './projectInitializer';
import {DeviceOperator} from './DeviceOperator';
import {AzureOperator} from './AzureOperator';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors
  // (console.error) This line of code will only be executed once when your
  // extension is activated
  console.log(
      'Congratulations, your extension "vscode-azure-iot-studio" is now active!');

  const projectInitializer = new ProjectInitializer();
  const deviceOperator = new DeviceOperator();
  const azureOperator = new AzureOperator();

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json

  const projectInit = vscode.commands.registerCommand(
      'azureiotstudio.initializeProject', async () => {
        await projectInitializer.InitializeProject(context);
      });

  const azureProvision = vscode.commands.registerCommand(
      'azureiotstudio.azureProvision', async () => {
        await azureOperator.Provision(context);
      });

  const azureDeploy = vscode.commands.registerCommand(
      'azureiotstudio.azureDeploy', async () => {
        await azureOperator.Deploy(context);
      });

  const deviceCompile = vscode.commands.registerCommand(
      'azureiotstudio.deviceCompile', async () => {
        await deviceOperator.Compile(context);
      });

  const deviceUpload = vscode.commands.registerCommand(
      'azureiotstudio.deviceUpload', async () => {
        await deviceOperator.Upload(context);
      });

  context.subscriptions.push(projectInit);
  context.subscriptions.push(azureProvision);
  context.subscriptions.push(azureDeploy);
  context.subscriptions.push(deviceCompile);
  context.subscriptions.push(deviceUpload);
}

// this method is called when your extension is deactivated
export function deactivate() {}