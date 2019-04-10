// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {VSCExpress} from 'vscode-express';
import {BoardProvider} from './boardProvider';
import {ProjectInitializer} from './projectInitializer';
import {DeviceOperator} from './DeviceOperator';
import {AzureOperator} from './AzureOperator';
import {ExampleExplorer} from './exampleExplorer';
import {IoTWorkbenchSettings} from './IoTSettings';
import {ConfigHandler} from './configHandler';
import {ConfigKey, EventNames} from './constants';
import {TelemetryContext, callWithTelemetry, TelemetryWorker, TelemetryProperties} from './telemetry';
import {UsbDetector} from './usbDetector';
import {CodeGenerateCore} from './pnp/CodeGenerateCore';
import {PnPMetaModelUtility, PnPMetaModelContext} from './pnp/PnPMetaModelUtility';
import {PnPMetaModelParser, PnPMetaModelGraph} from './pnp/PnPMetaModelGraph';
import {DeviceModelOperator} from './pnp/DeviceModelOperator';
import {PnPMetaModelJsonParser} from './pnp/PnPMetaModelJsonParser';
import {PnPDiagnostic} from './pnp/PnPDiagnostic';

const impor = require('impor')(__dirname);
const ioTProjectModule =
    impor('./Models/IoTProject') as typeof import('./Models/IoTProject');
const request = impor('request-promise') as typeof import('request-promise');

function getDocumentType(document: vscode.TextDocument) {
  if (/\.interface\.json$/.test(document.uri.fsPath)) {
    return 'Interface';
  }

  return 'CapabilityModel';
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
      vscode.window.createOutputChannel('Azure IoT Device Workbench');

  // Initialize Telemetry
  TelemetryWorker.Initialize(context);

  const deviceModelOperator = new DeviceModelOperator();

  // PnP Language Server
  const pnpContext = new PnPMetaModelUtility(context);
  const pnpInterface: PnPMetaModelContext = await pnpContext.getInterface();
  const pnpCapabilityModel: PnPMetaModelContext =
      await pnpContext.getCapabilityModel();
  const pnpGraph: PnPMetaModelGraph = await pnpContext.getGraph();
  const pnpParser =
      new PnPMetaModelParser(pnpGraph, pnpInterface, pnpCapabilityModel);
  const pnpDiagnostic =
      new PnPDiagnostic(pnpParser, pnpInterface, pnpCapabilityModel);

  const activeEditor = vscode.window.activeTextEditor;

  if (activeEditor) {
    const document = activeEditor.document;
    if (/\.(interface|capabilitymodel)\.json$/.test(document.uri.fsPath)) {
      const documentType = getDocumentType(document);
      if (documentType === 'Interface') {
        pnpDiagnostic.update(pnpInterface, document);
      } else {
        pnpDiagnostic.update(pnpCapabilityModel, document);
      }
    }
  }

  let waitingForUpdatingDiagnostic: NodeJS.Timer|null = null;

  vscode.workspace.onDidOpenTextDocument((document) => {
    if (!/\.(interface|capabilitymodel)\.json$/.test(document.uri.fsPath)) {
      return;
    }

    waitingForUpdatingDiagnostic = setTimeout(() => {
      const documentType = getDocumentType(document);
      if (documentType === 'Interface') {
        pnpDiagnostic.update(pnpInterface, document);
      } else {
        pnpDiagnostic.update(pnpCapabilityModel, document);
      }
    }, 0);
  });

  vscode.workspace.onDidChangeTextDocument((event) => {
    const document = event.document;
    if (!/\.(interface|capabilitymodel)\.json$/.test(document.uri.fsPath)) {
      return;
    }

    if (waitingForUpdatingDiagnostic) {
      clearTimeout(waitingForUpdatingDiagnostic);
    }

    waitingForUpdatingDiagnostic = setTimeout(() => {
      const documentType = getDocumentType(document);
      if (documentType === 'Interface') {
        pnpDiagnostic.update(pnpInterface, document);
      } else {
        pnpDiagnostic.update(pnpCapabilityModel, document);
      }
      waitingForUpdatingDiagnostic = null;
    }, 500);
  });

  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (!editor) {
      return;
    }

    const document = editor.document;
    if (!/\.(interface|capabilitymodel)\.json$/.test(document.uri.fsPath)) {
      return;
    }

    const documentType = getDocumentType(document);
    if (documentType === 'Interface') {
      pnpDiagnostic.update(pnpInterface, document);
    } else {
      pnpDiagnostic.update(pnpCapabilityModel, document);
    }
  });

  vscode.workspace.onDidCloseTextDocument((document) => {
    if (!/\.(interface|capabilitymodel)\.json$/.test(document.uri.fsPath)) {
      return;
    }

    const documentType = getDocumentType(document);
    if (documentType === 'Interface') {
      pnpDiagnostic.delete(document);
    } else {
      pnpDiagnostic.delete(document);
    }
  });

  vscode.languages.registerHoverProvider(
      {
        language: 'json',
        scheme: 'file',
        pattern: '**/*.{interface,capabilitymodel}.json'
      },
      {
        async provideHover(
            document, position, token): Promise<vscode.Hover|null> {
          const id = PnPMetaModelJsonParser.getIdAtPosition(
              document, position, pnpInterface);
          let hoverText: string|undefined = undefined;
          if (id) {
            if (id === '@id') {
              hoverText =
                  'An identifier for PnP capability model or interface.';
            } else if (id === '@type') {
              hoverText = 'The type of PnP meta model object.';
            } else if (id === '@context') {
              hoverText = 'The context for PnP capability model or interface.';
            } else {
              hoverText = pnpParser.getCommentFromId(id);
            }
          }
          return hoverText ? new vscode.Hover(hoverText) : null;
        }
      });

  vscode.languages.registerCompletionItemProvider(
      {
        language: 'json',
        scheme: 'file',
        pattern: '**/*.{interface,capabilitymodel}.json'
      },
      {
        provideCompletionItems(document, position): vscode.CompletionList |
        null {
          const documentType = getDocumentType(document);

          const jsonInfo =
              PnPMetaModelJsonParser.getJsonInfoAtPosition(document, position);
          const contextType =
              PnPMetaModelJsonParser.getPnpContextTypeAtPosition(
                  document, position, documentType);

          let pnpContext: PnPMetaModelContext;
          if (contextType === 'Interface') {
            pnpContext = pnpInterface;
          } else {
            pnpContext = pnpCapabilityModel;
          }

          if (!jsonInfo) {
            return null;
          }
          if (jsonInfo.isValue) {
            let values: string[] = [];
            if (jsonInfo.key === '@context') {
              const contextUri = contextType === 'Interface' ?
                  'http://azureiot.com/v0/contexts/Interface.json' :
                  'http://azureiot.com/v0/contexts/CapabilityModel.json';
              values = [contextUri];
            } else if (jsonInfo.key === '@type') {
              if (jsonInfo.lastKey) {
                const id =
                    pnpParser.getIdFromShortName(pnpContext, jsonInfo.lastKey);
                if (!id) {
                  return null;
                }
                values = pnpParser.getTypesFromId(pnpContext, id);
              } else {
                values = [contextType];
              }

            } else {
              values = pnpParser.getStringValuesFromShortName(
                  pnpContext, jsonInfo.key);
            }

            const range = PnPMetaModelJsonParser.getTokenRange(
                jsonInfo.json.tokens, jsonInfo.offset);
            const startPosition = document.positionAt(range.startIndex);
            const endPosition = document.positionAt(range.endIndex);
            const completionItems =
                PnPMetaModelJsonParser.getCompletionItemsFromArray(
                    values, position, startPosition, endPosition);
            return new vscode.CompletionList(completionItems, false);
          } else {
            let keyList:
                Array<{label: string, required: boolean, type?: string}> = [];
            const completionKeyList:
                Array<{label: string, required: boolean, type?: string}> = [];
            if (!jsonInfo.type) {
              const id =
                  pnpParser.getIdFromShortName(pnpContext, jsonInfo.lastKey);
              if (id) {
                const values = pnpParser.getTypesFromId(pnpContext, id);
                if (values.length === 1 && values[0] !== 'Interface' &&
                    values[0] !== 'CapabilityModel') {
                  jsonInfo.type = values[0];
                }
              }
            }

            if (jsonInfo.type) {
              if ((jsonInfo.type === 'Interface' ||
                   jsonInfo.type === 'CapabilityModel') &&
                  jsonInfo.properties.indexOf('@context') === -1) {
                completionKeyList.push({label: '@context', required: true});
              }
              keyList = pnpParser.getTypedPropertiesFromType(
                  pnpContext, jsonInfo.type);
            } else {
              keyList = [{label: '@type', required: true}];
            }

            for (const key of keyList) {
              if (jsonInfo.properties.indexOf(key.label) === -1) {
                completionKeyList.push(key);
              }
            }

            if ((jsonInfo.type === 'Interface' ||
                 jsonInfo.type === 'CapabilityModel') &&
                jsonInfo.properties.indexOf('@id') === -1) {
              completionKeyList.push(
                  {label: '@id', required: true, type: 'string'});
            }

            const range = PnPMetaModelJsonParser.getTokenRange(
                jsonInfo.json.tokens, jsonInfo.offset);
            const startPosition = document.positionAt(range.startIndex);
            const endPosition = document.positionAt(range.endIndex);
            const completionItems =
                PnPMetaModelJsonParser.getCompletionItemsFromArray(
                    completionKeyList, position, startPosition, endPosition);
            console.log(completionItems);
            return new vscode.CompletionList(completionItems, false);
          }
        }
      },
      '"');

  const codeGenerator = new CodeGenerateCore();

  const telemetryContext: TelemetryContext = {
    properties: {result: 'Succeeded', error: '', errorMessage: ''},
    measurements: {duration: 0}
  };
  const iotProject =
      new ioTProjectModule.IoTProject(context, outputChannel, telemetryContext);
  if (vscode.workspace.workspaceFolders) {
    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const deviceModelResult =
        await deviceModelOperator.Load(rootPath, context, outputChannel);

    if (!deviceModelResult) {
      try {
        await iotProject.load();
      } catch (error) {
        // do nothing as we are not sure whether the project is initialized.
      }
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

  const codeGeneratorBinder =
      codeGenerator.ScaffoldDeviceStub.bind(codeGenerator);

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json

  const projectInitProvider = async () => {
    callWithTelemetry(
        EventNames.createNewProjectEvent, outputChannel, true, context,
        projectInitializerBinder);
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

  const deviceModelCreateInterfaceProvider = async () => {
    deviceModelOperator.CreateInterface(context, outputChannel);
  };

  const deviceModelCreateCapabilityModelProvider = async () => {
    deviceModelOperator.CreateCapabilityModel(context, outputChannel);
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
          const boardProvider = new BoardProvider(context);
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

  vscode.commands.registerCommand(
      'iotworkbench.getInterfaces',
      async (
          searchString?: string, publicRepository = false, pageSize?: number,
          continueToken?: string) => {
        return await deviceModelOperator.GetInterfaces(
            context, publicRepository, searchString, pageSize, continueToken);
      });

  vscode.commands.registerCommand(
      'iotworkbench.getCapabilityModels',
      async (
          searchString?: string, publicRepository = false, pageSize?: number,
          continueToken?: string) => {
        return await deviceModelOperator.GetCapabilityModels(
            context, publicRepository, searchString, pageSize, continueToken);
      });

  vscode.commands.registerCommand(
      'iotworkbench.deletePnPFiles',
      async (interfaceIds: string[], metaModelValue: string) => {
        await deviceModelOperator.DeletePnPFiles(
            interfaceIds, metaModelValue, context, outputChannel);
      });

  vscode.commands.registerCommand(
      'iotworkbench.editPnPFiles',
      async (
          fileIds: string[], metaModelValue: string,
          publicRepository = false) => {
        await deviceModelOperator.DownloadAndEditPnPFiles(
            fileIds, metaModelValue, publicRepository, context, outputChannel);
      });

  vscode.commands.registerCommand(
      'iotworkbench.createPnPInterface', deviceModelCreateInterfaceProvider);

  vscode.commands.registerCommand(
      'iotworkbench.createPnPCapabilityModel',
      deviceModelCreateCapabilityModelProvider);

  context.subscriptions.push(vscode.commands.registerCommand(
      'iotworkbench.pnpOpenRepository', async () => {
        deviceModelOperator.ConnectModelRepository(context, outputChannel);
      }));
  context.subscriptions.push(vscode.commands.registerCommand(
      'iotworkbench.pnpSignOutRepository', async () => {
        deviceModelOperator.Disconnect();
      }));
  context.subscriptions.push(vscode.commands.registerCommand(
      'iotworkbench.pnpCreateInterface', async () => {
        deviceModelOperator.CreateInterface(context, outputChannel);
      }));
  context.subscriptions.push(vscode.commands.registerCommand(
      'iotworkbench.pnpCreateCapabilityModel', async () => {
        deviceModelOperator.CreateCapabilityModel(context, outputChannel);
      }));
  context.subscriptions.push(vscode.commands.registerCommand(
      'iotworkbench.pnpSubmitFile', async () => {
        deviceModelOperator.SubmitMetaModelFiles(context, outputChannel);
      }));
  context.subscriptions.push(vscode.commands.registerCommand(
      'iotworkbench.pnpGenerateCode', async () => {
        callWithTelemetry(
            EventNames.scaffoldDeviceStubEvent, outputChannel, true, context,
            codeGeneratorBinder);
      }));
}

// this method is called when your extension is deactivated
export async function deactivate() {
  await TelemetryWorker.dispose();
}