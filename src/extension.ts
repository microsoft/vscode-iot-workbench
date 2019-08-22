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
import {CodeGeneratorCore} from './DigitalTwin/CodeGeneratorCore';
import {DigitalTwinMetaModelUtility, DigitalTwinMetaModelContext} from './DigitalTwin/DigitalTwinMetaModelUtility';
import {DigitalTwinMetaModelParser, DigitalTwinMetaModelGraph} from './DigitalTwin/DigitalTwinMetaModelGraph';
import {DeviceModelOperator} from './DigitalTwin/DeviceModelOperator';
import {DigitalTwinMetaModelJsonParser} from './DigitalTwin/DigitalTwinMetaModelJsonParser';
import {DigitalTwinDiagnostic} from './DigitalTwin/DigitalTwinDiagnostic';
import {DigitalTwinConstants} from './DigitalTwin/DigitalTwinConstants';
import {DTDLKeywords} from './DigitalTwin/DigitalTwinConstants';
import {ConfigKey, ContextUris, EventNames, FileNames, ModelType, ScaffoldType} from './constants';
import {TelemetryContext, TelemetryProperties} from './telemetry';
import {RemoteExtension} from './Models/RemoteExtension';
import {constructAndLoadIoTProject} from './utils';
import {ProjectEnvironmentConfiger} from './ProjectEnvironmentConfiger';

const impor = require('impor')(__dirname);
const exampleExplorerModule =
    impor('./exampleExplorer') as typeof import('./exampleExplorer');

const telemetryModule = impor('./telemetry') as typeof import('./telemetry');
const request = impor('request-promise') as typeof import('request-promise');

interface SuggestionInfo {
  label: string;
  required: boolean;
  type?: string;
}

function getDocumentType(document: vscode.TextDocument) {
  if (/\.interface\.json$/.test(document.uri.fsPath)) {
    return ModelType.Interface;
  }

  return ModelType.CapabilityModel;
}

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

  const deviceModelOperator = new DeviceModelOperator();

  // IoT Plug and Play Language Server
  const dtContext = new DigitalTwinMetaModelUtility(context);
  const dtInterface: DigitalTwinMetaModelContext =
      await dtContext.getInterface();
  const dtCapabilityModel: DigitalTwinMetaModelContext =
      await dtContext.getCapabilityModel();
  const dtIoTModel: DigitalTwinMetaModelContext = await dtContext.getIoTModel();
  const dtGraph: DigitalTwinMetaModelGraph = await dtContext.getGraph();
  const dtParser = new DigitalTwinMetaModelParser(dtGraph);
  const dtDiagnostic = new DigitalTwinDiagnostic(dtParser);

  const activeEditor = vscode.window.activeTextEditor;

  if (activeEditor) {
    const document = activeEditor.document;
    if (/\.(interface|capabilitymodel)\.json$/.test(document.uri.fsPath)) {
      const contextUris =
          DigitalTwinMetaModelJsonParser.getContextUris(document);
      const documentType = getDocumentType(document);
      if (documentType === ModelType.Interface &&
          contextUris.indexOf(ContextUris.interface) >= 0) {
        dtDiagnostic.update(dtInterface, document);
      } else if (
          documentType === ModelType.Interface &&
          contextUris.indexOf(ContextUris.capabilityModel) >= 0) {
        dtDiagnostic.update(dtCapabilityModel, document);
      } else {
        console.log('using IoTModel.json');
        dtDiagnostic.update(dtIoTModel, document);
      }
    }
  }

  let waitingForUpdatingDiagnostic: NodeJS.Timer|null = null;

  vscode.workspace.onDidOpenTextDocument(document => {
    if (!/\.(interface|capabilitymodel)\.json$/.test(document.uri.fsPath)) {
      return;
    }

    waitingForUpdatingDiagnostic = setTimeout(() => {
      const contextUris =
          DigitalTwinMetaModelJsonParser.getContextUris(document);
      const documentType = getDocumentType(document);
      if (documentType === ModelType.Interface &&
          contextUris.indexOf(ContextUris.interface) >= 0) {
        dtDiagnostic.update(dtInterface, document);
      } else if (
          documentType === ModelType.Interface &&
          contextUris.indexOf(ContextUris.capabilityModel) >= 0) {
        dtDiagnostic.update(dtCapabilityModel, document);
      } else {
        console.log('using IoTModel.json');
        dtDiagnostic.update(dtIoTModel, document);
      }
    }, 0);
  });

  vscode.workspace.onDidChangeTextDocument(event => {
    const document = event.document;
    if (!/\.(interface|capabilitymodel)\.json$/.test(document.uri.fsPath)) {
      return;
    }

    if (waitingForUpdatingDiagnostic) {
      clearTimeout(waitingForUpdatingDiagnostic);
    }

    waitingForUpdatingDiagnostic = setTimeout(() => {
      const contextUris =
          DigitalTwinMetaModelJsonParser.getContextUris(document);
      const documentType = getDocumentType(document);
      if (documentType === ModelType.Interface &&
          contextUris.indexOf(ContextUris.interface) >= 0) {
        dtDiagnostic.update(dtInterface, document);
      } else if (
          documentType === ModelType.Interface &&
          contextUris.indexOf(ContextUris.capabilityModel) >= 0) {
        dtDiagnostic.update(dtCapabilityModel, document);
      } else {
        console.log('using IoTModel.json');
        dtDiagnostic.update(dtIoTModel, document);
      }
      waitingForUpdatingDiagnostic = null;
    }, 500);
  });

  vscode.window.onDidChangeActiveTextEditor(editor => {
    if (!editor) {
      return;
    }

    const document = editor.document;
    if (!/\.(interface|capabilitymodel)\.json$/.test(document.uri.fsPath)) {
      return;
    }

    const contextUris = DigitalTwinMetaModelJsonParser.getContextUris(document);
    const documentType = getDocumentType(document);
    if (documentType === ModelType.Interface &&
        contextUris.indexOf(ContextUris.interface) >= 0) {
      dtDiagnostic.update(dtInterface, document);
    } else if (
        documentType === ModelType.Interface &&
        contextUris.indexOf(ContextUris.capabilityModel) >= 0) {
      dtDiagnostic.update(dtCapabilityModel, document);
    } else {
      console.log('using IoTModel.json');
      dtDiagnostic.update(dtIoTModel, document);
    }
  });

  vscode.workspace.onDidCloseTextDocument(document => {
    if (!/\.(interface|capabilitymodel)\.json$/.test(document.uri.fsPath)) {
      return;
    }

    const documentType = getDocumentType(document);
    if (documentType === ModelType.Interface) {
      dtDiagnostic.delete(document);
    } else {
      dtDiagnostic.delete(document);
    }
  });

  vscode.languages.registerHoverProvider(
      {
        language: 'json',
        scheme: 'file',
        pattern: '**/*.{interface,capabilitymodel}.json'
      },
      {
        async provideHover(document, position, token):
            Promise<vscode.Hover|null> {
              const id = DigitalTwinMetaModelJsonParser.getIdAtPosition(
                  document, position, dtInterface);
              let hoverText: string|undefined = undefined;
              if (id) {
                if (id === '@id') {
                  hoverText = `An identifier for ${
                      DigitalTwinConstants
                          .productName} Capability Model or interface.`;
                } else if (id === '@type') {
                  hoverText = `The type of ${
                      DigitalTwinConstants.productName} meta model object.`;
                } else if (id === '@context') {
                  hoverText = `The context for ${
                      DigitalTwinConstants
                          .productName} Capability Model or interface.`;
                } else {
                  hoverText = dtParser.getCommentFromId(id);
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

          const jsonInfo = DigitalTwinMetaModelJsonParser.getJsonInfoAtPosition(
              document, position);
          const contextType = DigitalTwinMetaModelJsonParser
                                  .getDigitalTwinContextTypeAtPosition(
                                      document, position, documentType);

          let dtContext: DigitalTwinMetaModelContext;

          const contextUris =
              DigitalTwinMetaModelJsonParser.getContextUris(document);
          if (documentType === ModelType.Interface &&
              contextUris.indexOf(ContextUris.interface) >= 0) {
            dtContext = dtInterface;
          } else if (
              documentType === ModelType.Interface &&
              contextUris.indexOf(ContextUris.capabilityModel) >= 0) {
            dtContext = dtCapabilityModel;
          } else {
            console.log('using IoTModel.json');
            dtContext = dtIoTModel;
          }

          if (!jsonInfo) {
            return null;
          }
          if (jsonInfo.isValue) {
            let values: string[] = [];
            if (jsonInfo.key === '@context') {
              const contextUri = contextType === ModelType.Interface ?
                  ContextUris.interface :
                  ContextUris.capabilityModel;
              values = [contextUri, ContextUris.iotModel];
            } else if (jsonInfo.key === '@type') {
              if (jsonInfo.lastKey) {
                const id =
                    dtParser.getIdFromShortName(dtContext, jsonInfo.lastKey);
                if (!id) {
                  return null;
                }
                values = dtParser.getTypesFromId(dtContext, id);
              } else {
                values = [contextType];
              }
            } else if (
                jsonInfo.key === 'schema' &&
                jsonInfo.lastKey === 'implements') {
              // >>> TODO
              // This's a workaroud for issue
              // https://dev.azure.com/mseng/VSIoT/_workitems/edit/1575737,
              // which caused by the wrong DTDL.
              // Should be removed once the DTDL is fixed.
              jsonInfo.key = DTDLKeywords.inlineInterfaceKeyName;
              values = dtParser.getStringValuesFromShortName(
                  dtContext, jsonInfo.key);
              // <<<
            } else {
              values = dtParser.getStringValuesFromShortName(
                  dtContext, jsonInfo.key);
            }

            const range = DigitalTwinMetaModelJsonParser.getTokenRange(
                jsonInfo.json.tokens, jsonInfo.offset);
            const startPosition = document.positionAt(range.startIndex);
            const endPosition = document.positionAt(range.endIndex);
            const completionItems =
                DigitalTwinMetaModelJsonParser.getCompletionItemsFromArray(
                    values, position, startPosition, endPosition);
            return new vscode.CompletionList(completionItems, false);
          } else {
            let keyList: SuggestionInfo[] = [];
            const completionKeyList: SuggestionInfo[] = [];
            if (!jsonInfo.type ||
                (Array.isArray(jsonInfo.type) && jsonInfo.type.length === 0)) {
              const id =
                  dtParser.getIdFromShortName(dtContext, jsonInfo.lastKey);
              if (id) {
                const values = dtParser.getTypesFromId(dtContext, id);
                if (values.length === 1 && values[0] !== ModelType.Interface &&
                    values[0] !== ModelType.CapabilityModel) {
                  jsonInfo.type = values[0];
                }
              }
            }

            if ((typeof jsonInfo.type === 'string' && jsonInfo.type !== '') ||
                (Array.isArray(jsonInfo.type) && jsonInfo.type.length > 0)) {
              if ((jsonInfo.type === ModelType.Interface ||
                   jsonInfo.type === ModelType.CapabilityModel) &&
                  jsonInfo.properties.indexOf('@context') === -1) {
                completionKeyList.push({label: '@context', required: true});
              }
              if (Array.isArray(jsonInfo.type)) {
                for (const currentType of jsonInfo.type) {
                  keyList = keyList.concat(dtParser.getTypedPropertiesFromType(
                      dtContext, currentType));
                }
                const completionObject: {
                  [key: string]:
                      {required: boolean; type: string | undefined};
                } = {};
                for (const keyObject of keyList) {
                  completionObject[keyObject.label] = {
                    required: (completionObject[keyObject.label] &&
                               completionObject[keyObject.label].required) ||
                        keyObject.required,
                    type: completionObject[keyObject.label] ?
                        completionObject[keyObject.label].type :
                        keyObject.type
                  };
                }
                keyList = [];
                for (const key of Object.keys(completionObject)) {
                  keyList.push({
                    label: key,
                    required: completionObject[key].required,
                    type: completionObject[key].type
                  });
                }
              } else {
                keyList = dtParser.getTypedPropertiesFromType(
                    dtContext, jsonInfo.type);
              }
            } else {
              keyList = [{label: '@type', required: true}];
            }

            for (const key of keyList) {
              if (jsonInfo.properties.indexOf(key.label) === -1) {
                // >>> TODO
                // This's a workaroud for issue
                // https://dev.azure.com/mseng/VSIoT/_workitems/edit/1575737,
                // which caused by the wrong DTDL.
                // Should be removed once the DTDL is fixed.
                if (!jsonInfo.isValue &&
                    key.label === DTDLKeywords.inlineInterfaceKeyName &&
                    jsonInfo.type === ModelType.InlineInterface) {
                  key.label = 'schema';
                }
                // <<<
                completionKeyList.push(key);
              }
            }

            if ((jsonInfo.type === ModelType.Interface ||
                 jsonInfo.type === ModelType.CapabilityModel) &&
                jsonInfo.properties.indexOf('@id') === -1) {
              completionKeyList.push(
                  {label: '@id', required: true, type: 'string'});
            }

            const range = DigitalTwinMetaModelJsonParser.getTokenRange(
                jsonInfo.json.tokens, jsonInfo.offset);
            const startPosition = document.positionAt(range.startIndex);
            const endPosition = document.positionAt(range.endIndex);
            const completionItems =
                DigitalTwinMetaModelJsonParser.getCompletionItemsFromArray(
                    completionKeyList, position, startPosition, endPosition);
            console.log(completionItems);
            return new vscode.CompletionList(completionItems, false);
          }
        }
      },
      '"');

  const telemetryContext: TelemetryContext = {
    properties: {result: 'Succeeded', error: '', errorMessage: ''},
    measurements: {duration: 0}
  };

  // Load iot Project here and do not ask to new an iot project when no iot
  // project open since no command has been triggered yet.
  await constructAndLoadIoTProject(
      context, outputChannel, telemetryContext, false);
  const deviceOperator = new DeviceOperator();
  const azureOperator = new AzureOperator();
  const exampleExplorer = new exampleExplorerModule.ExampleExplorer();

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json

  const projectInitProvider = async () => {
    // Initialize Telemetry
    if (!telemetryWorkerInitialized) {
      telemetryModule.TelemetryWorker.initialize(context);
      telemetryWorkerInitialized = true;
    }

    const projectInitializer = new ProjectInitializer();
    const projectInitializerBinder =
        projectInitializer.InitializeProject.bind(projectInitializer);
    telemetryModule.callWithTelemetry(
        EventNames.createNewProjectEvent, outputChannel, true, context,
        projectInitializerBinder);
  };

  const projectEnvironmentConfigProvider = async () => {
    // Initialize Telemetry
    if (!telemetryWorkerInitialized) {
      telemetryModule.TelemetryWorker.initialize(context);
      telemetryWorkerInitialized = true;
    }

    const projectEnvConfiger = new ProjectEnvironmentConfiger();
    const projectEnvConfigBinder =
        projectEnvConfiger.configureProjectEnvironment.bind(projectEnvConfiger);
    telemetryModule.callWithTelemetry(
        EventNames.configProjectEnvironmentEvent, outputChannel, true, context,
        projectEnvConfigBinder);
  };

  const azureProvisionProvider = async () => {
    // Initialize Telemetry
    if (!telemetryWorkerInitialized) {
      telemetryModule.TelemetryWorker.initialize(context);
      telemetryWorkerInitialized = true;
    }

    const azureProvisionBinder = azureOperator.provision.bind(azureOperator);
    telemetryModule.callWithTelemetry(
        EventNames.azureProvisionEvent, outputChannel, true, context,
        azureProvisionBinder);
  };

  const azureDeployProvider = async () => {
    // Initialize Telemetry
    if (!telemetryWorkerInitialized) {
      telemetryModule.TelemetryWorker.initialize(context);
      telemetryWorkerInitialized = true;
    }

    const azureDeployBinder = azureOperator.deploy.bind(azureOperator);
    telemetryModule.callWithTelemetry(
        EventNames.azureDeployEvent, outputChannel, true, context,
        azureDeployBinder);
  };

  const deviceCompileProvider = async () => {
    // Initialize Telemetry
    if (!telemetryWorkerInitialized) {
      telemetryModule.TelemetryWorker.initialize(context);
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
      telemetryModule.TelemetryWorker.initialize(context);
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
      telemetryModule.TelemetryWorker.initialize(context);
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
      telemetryModule.TelemetryWorker.initialize(context);
      telemetryWorkerInitialized = true;
    }

    const exampleSelectBoardBinder =
        exampleExplorer.selectBoard.bind(exampleExplorer);
    telemetryModule.callWithTelemetry(
        EventNames.openExamplePageEvent, outputChannel, true, context,
        exampleSelectBoardBinder);
  };

  const examplesInitializeProvider =
      async (name?: string, url?: string, boardId?: string) => {
    // Initialize Telemetry
    if (!telemetryWorkerInitialized) {
      telemetryModule.TelemetryWorker.initialize(context);
      telemetryWorkerInitialized = true;
    }

    const initializeExampleBinder =
        exampleExplorer.initializeExample.bind(exampleExplorer);
    telemetryModule.callWithTelemetry(
        EventNames.loadExampleEvent, outputChannel, true, context,
        initializeExampleBinder, {}, name, url, boardId);
  };

  const projectInit = vscode.commands.registerCommand(
      'iotworkbench.initializeProject', projectInitProvider);

  const configureContainer = vscode.commands.registerCommand(
      'iotworkbench.configureProjectEnvironment',
      projectEnvironmentConfigProvider);
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
          telemetryModule.TelemetryWorker.initialize(context);
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
        const notRemote = RemoteExtension.checkLocalBeforeRunCommand(context);
        if (!notRemote) {
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
  context.subscriptions.push(configureContainer);
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

  // IoT Plug and Play commands
  vscode.commands.registerCommand(
      'iotworkbench.getInterfaces',
      async (
          searchString?: string, publicRepository = false, pageSize?: number,
          continueToken?: string) => {
        // Initialize Telemetry
        if (!telemetryWorkerInitialized) {
          telemetryModule.TelemetryWorker.initialize(context);
          telemetryWorkerInitialized = true;
        }

        return telemetryModule.callWithTelemetry(
            EventNames.pnpGetInterfacesEvent, outputChannel, true, context,
            deviceModelOperator.getInterfaces.bind(deviceModelOperator), {},
            publicRepository, searchString, pageSize, continueToken);
      });

  vscode.commands.registerCommand(
      'iotworkbench.getCapabilityModels',
      async (
          searchString?: string, publicRepository = false, pageSize?: number,
          continueToken?: string) => {
        // Initialize Telemetry
        if (!telemetryWorkerInitialized) {
          telemetryModule.TelemetryWorker.initialize(context);
          telemetryWorkerInitialized = true;
        }

        return telemetryModule.callWithTelemetry(
            EventNames.pnpGetCapabilityModelsEvent, outputChannel, true,
            context,
            deviceModelOperator.getCapabilityModels.bind(deviceModelOperator),
            {}, publicRepository, searchString, pageSize, continueToken);
      });

  vscode.commands.registerCommand(
      'iotworkbench.deleteMetamodelFiles',
      async (interfaceIds: string[], metaModelValue: string) => {
        // Initialize Telemetry
        if (!telemetryWorkerInitialized) {
          telemetryModule.TelemetryWorker.initialize(context);
          telemetryWorkerInitialized = true;
        }

        telemetryModule.callWithTelemetry(
            EventNames.pnpDeleteModelsEvent, outputChannel, true, context,
            deviceModelOperator.deleteMetamodelFiles.bind(deviceModelOperator),
            {}, interfaceIds, metaModelValue);
      });

  vscode.commands.registerCommand(
      'iotworkbench.editMetamodelFiles',
      async (
          fileIds: string[], metaModelValue: string,
          publicRepository = false) => {
        // Initialize Telemetry
        if (!telemetryWorkerInitialized) {
          telemetryModule.TelemetryWorker.initialize(context);
          telemetryWorkerInitialized = true;
        }

        const pnpEditModelsBinder =
            deviceModelOperator.downloadAndEditMetamodelFiles.bind(
                deviceModelOperator);
        telemetryModule.callWithTelemetry(
            EventNames.pnpEditModelsEvent, outputChannel, true, context,
            pnpEditModelsBinder, {}, fileIds, metaModelValue, publicRepository);
      });

  context.subscriptions.push(vscode.commands.registerCommand(
      'iotworkbench.iotPnPOpenRepository', async () => {
        // Initialize Telemetry
        if (!telemetryWorkerInitialized) {
          telemetryModule.TelemetryWorker.initialize(context);
          telemetryWorkerInitialized = true;
        }
        telemetryModule.callWithTelemetry(
            EventNames.pnpConnectModelRepoEvent, outputChannel, true, context,
            deviceModelOperator.connectModelRepository.bind(
                deviceModelOperator));
      }));

  context.subscriptions.push(vscode.commands.registerCommand(
      'iotworkbench.iotPnPSignOutRepository', async () => {
        // Initialize Telemetry
        if (!telemetryWorkerInitialized) {
          telemetryModule.TelemetryWorker.initialize(context);
          telemetryWorkerInitialized = true;
        }
        telemetryModule.callWithTelemetry(
            EventNames.pnpConnectModelRepoEvent, outputChannel, true, context,
            deviceModelOperator.disconnect.bind(deviceModelOperator));
      }));

  context.subscriptions.push(vscode.commands.registerCommand(
      'iotworkbench.iotPnPCreateInterface', async () => {
        // Initialize Telemetry
        if (!telemetryWorkerInitialized) {
          telemetryModule.TelemetryWorker.initialize(context);
          telemetryWorkerInitialized = true;
        }

        const pnpCreateInterfaceBinder =
            deviceModelOperator.createInterface.bind(deviceModelOperator);

        telemetryModule.callWithTelemetry(
            EventNames.pnpCreateInterfaceEvent, outputChannel, true, context,
            pnpCreateInterfaceBinder);
      }));

  context.subscriptions.push(vscode.commands.registerCommand(
      'iotworkbench.iotPnPCreateCapabilityModel', async () => {
        // Initialize Telemetry
        if (!telemetryWorkerInitialized) {
          telemetryModule.TelemetryWorker.initialize(context);
          telemetryWorkerInitialized = true;
        }

        const pnpCreateCapabilityModelBinder =
            deviceModelOperator.createCapabilityModel.bind(deviceModelOperator);

        telemetryModule.callWithTelemetry(
            EventNames.pnpCreateCapabilityModelEvent, outputChannel, true,
            context, pnpCreateCapabilityModelBinder);
      }));

  context.subscriptions.push(vscode.commands.registerCommand(
      'iotworkbench.iotPnPSubmitFile', async () => {
        // Initialize Telemetry
        if (!telemetryWorkerInitialized) {
          telemetryModule.TelemetryWorker.initialize(context);
          telemetryWorkerInitialized = true;
        }

        const pnpSubmitModelFilesBinder =
            deviceModelOperator.submitMetaModelFiles.bind(deviceModelOperator);
        telemetryModule.callWithTelemetry(
            EventNames.pnpSubmitMetaModelFilesEvent, outputChannel, true,
            context, pnpSubmitModelFilesBinder);
      }));

  context.subscriptions.push(vscode.commands.registerCommand(
      'iotworkbench.iotPnPGenerateCode', async () => {
        // Initialize Telemetry
        if (!telemetryWorkerInitialized) {
          telemetryModule.TelemetryWorker.initialize(context);
          telemetryWorkerInitialized = true;
        }

        const codeGenerator = new CodeGeneratorCore();
        const codeGeneratorBinder =
            codeGenerator.generateDeviceCodeStub.bind(codeGenerator);

        telemetryModule.callWithTelemetry(
            EventNames.scaffoldDeviceStubEvent, outputChannel, true, context,
            codeGeneratorBinder);
      }));

  // delay to detect usb
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
