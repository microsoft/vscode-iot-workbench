// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";
import { BoardProvider } from "./boardProvider";
import { ProjectInitializer } from "./projectInitializer";
import { DeviceOperator } from "./DeviceOperator";
import { AzureOperator } from "./AzureOperator";
import { IoTWorkbenchSettings } from "./IoTSettings";
import { ConfigHandler } from "./configHandler";
import { CodeGeneratorCore } from "./DigitalTwin/CodeGeneratorCore";
import { ConfigKey, EventNames, FileNames } from "./constants";
import { TelemetryContext, TelemetryWorker, TelemetryResult } from "./telemetry";
import { RemoteExtension } from "./Models/RemoteExtension";
import { constructAndLoadIoTProject } from "./utils";
import { ProjectEnvironmentConfiger } from "./ProjectEnvironmentConfiger";
import { WorkbenchExtension } from "./WorkbenchExtension";
import { WorkbenchCommands, VscodeCommands } from "./common/Commands";
import { ColorizedChannel } from "./DigitalTwin/pnp/src/common/colorizedChannel";
import { Constants } from "./DigitalTwin/pnp/src/common/constants";
import { DeviceModelManager, ModelType } from "./DigitalTwin/pnp/src/deviceModel/deviceModelManager";
import { ModelRepositoryManager } from "./DigitalTwin/pnp/src/modelRepository/modelRepositoryManager";
import { IntelliSenseUtility, ModelContent } from "./DigitalTwin/pnp/src/intelliSense/intelliSenseUtility";
import { DigitalTwinCompletionItemProvider } from "./DigitalTwin/pnp/src/intelliSense/digitalTwinCompletionItemProvider";
import { DigitalTwinHoverProvider } from "./DigitalTwin/pnp/src/intelliSense/digitalTwinHoverProvider";
import { DigitalTwinDiagnosticProvider } from "./DigitalTwin/pnp/src/intelliSense/digitalTwinDiagnosticProvider";
import { Command } from "./DigitalTwin/pnp/src/common/command";
import { UserCancelledError } from "./DigitalTwin/pnp/src/common/userCancelledError";
import { UI, MessageType } from "./DigitalTwin/pnp/src/view/ui";
import { ProcessError } from "./DigitalTwin/pnp/src/common/processError";
import { SearchResult } from "./DigitalTwin/pnp/src/modelRepository/modelRepositoryInterface";
import { NSAT } from "./nsat";
import { DigitalTwinUtility } from "./DigitalTwin/DigitalTwinUtility";

const importLazy = require("import-lazy");
const exampleExplorerModule = importLazy(() => require("./exampleExplorer"))();
const request = importLazy(() => require("request-promise"))();

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
let telemetryWorker: any = undefined;

function printHello(context: vscode.ExtensionContext): void {
  const extension = WorkbenchExtension.getExtension(context);
  if (!extension) {
    return;
  }

  const extensionId = extension.id;
  console.log(`Congratulations, your extension ${extensionId} is now active!`);
}

function initCommandWithTelemetry(
  context: vscode.ExtensionContext,
  telemetryWorker: TelemetryWorker,
  outputChannel: vscode.OutputChannel,
  command: WorkbenchCommands,
  eventName: string,
  enableSurvey: boolean,
  callback: (
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel,
    telemetrycontext: TelemetryContext,
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    ...args: any[]
  ) => // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  any,
  additionalProperties?: { [key: string]: string }
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(command, async (...commandArgs) =>
      telemetryWorker.callCommandWithTelemetry(
        context,
        outputChannel,
        eventName,
        enableSurvey,
        callback,
        additionalProperties,
        ...commandArgs
      )
    )
  );
}

function initCommand(
  context: vscode.ExtensionContext,
  command: WorkbenchCommands,
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  callback: (...args: any[]) => Promise<any>
): void {
  context.subscriptions.push(vscode.commands.registerCommand(command, callback));
}

function initIntelliSense(context: vscode.ExtensionContext, telemetryWorker: TelemetryWorker): void {
  // init DigitalTwin graph
  IntelliSenseUtility.initGraph(context);
  // register providers of completionItem and hover
  const selector: vscode.DocumentSelector = {
    language: "json",
    scheme: "file"
  };
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      selector,
      new DigitalTwinCompletionItemProvider(),
      Constants.COMPLETION_TRIGGER
    )
  );
  context.subscriptions.push(vscode.languages.registerHoverProvider(selector, new DigitalTwinHoverProvider()));
  // register diagnostic
  let pendingDiagnostic: NodeJS.Timer;
  const diagnosticCollection: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection(
    Constants.CHANNEL_NAME
  );
  const diagnosticProvider = new DigitalTwinDiagnosticProvider();
  const activeTextEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
  if (activeTextEditor && IntelliSenseUtility.isJsonFile(activeTextEditor.document)) {
    // delay it for DigitalTwin graph initialization
    pendingDiagnostic = setTimeout(
      () => diagnosticProvider.updateDiagnostics(activeTextEditor.document, diagnosticCollection),
      Constants.DEFAULT_TIMER_MS
    );
  }
  context.subscriptions.push(diagnosticCollection);
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(event => {
      if (event && IntelliSenseUtility.isJsonFile(event.document)) {
        diagnosticProvider.updateDiagnostics(event.document, diagnosticCollection);
      }
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      if (event && IntelliSenseUtility.isJsonFile(event.document)) {
        if (pendingDiagnostic) {
          clearTimeout(pendingDiagnostic);
        }
        pendingDiagnostic = setTimeout(
          () => diagnosticProvider.updateDiagnostics(event.document, diagnosticCollection),
          Constants.DEFAULT_TIMER_MS
        );
      }
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(document => {
      if (IntelliSenseUtility.isJsonFile(document)) {
        diagnosticCollection.delete(document.uri);
      }
    })
  );
  // send DigitalTwin usage telemetry
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(document => {
      if (IntelliSenseUtility.isJsonFile(document)) {
        const modelContent: ModelContent | undefined = IntelliSenseUtility.parseDigitalTwinModel(document.getText());
        if (modelContent) {
          const telemetryContext: TelemetryContext = telemetryWorker.createContext();
          telemetryContext.properties.result = TelemetryResult.Succeeded;
          telemetryContext.properties.dtdlVersion = modelContent.version.toString();
          telemetryWorker.sendEvent(Command.OpenFile, telemetryContext);
        }
      }
    })
  );
}

function initDigitalTwinCommand(
  context: vscode.ExtensionContext,
  telemetryWorker: TelemetryWorker,
  outputChannel: ColorizedChannel,
  enableSurvey: boolean,
  command: Command,
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  callback: (...args: any[]) => Promise<any>
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      command,
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      async (...args: any[]) => {
        const start: number = Date.now();
        const telemetryContext: TelemetryContext = telemetryWorker.createContext();
        args.push(telemetryContext);
        try {
          return await callback(...args);
        } catch (error) {
          telemetryContext.properties.errorType = error.name;
          telemetryContext.properties.errorMessage = error.message;
          if (error instanceof UserCancelledError) {
            telemetryContext.properties.result = TelemetryResult.Cancelled;
            outputChannel.warn(error.message);
          } else {
            telemetryContext.properties.result = TelemetryResult.Failed;
            UI.showNotification(MessageType.Error, error.message);
            if (error instanceof ProcessError) {
              const message = `${error.message}\n${error.stack}`;
              outputChannel.error(message, error.component);
            } else {
              outputChannel.error(error.message);
            }
          }
        } finally {
          telemetryContext.measurements.duration = (Date.now() - start) / 1000;
          telemetryWorker.sendEvent(command, telemetryContext);
          outputChannel.show();
          if (enableSurvey) {
            NSAT.takeSurvey(context);
          }
        }
      }
    )
  );
}

function initDigitalTwin(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): void {
  const colorizedChannel = new ColorizedChannel(Constants.CHANNEL_NAME);
  context.subscriptions.push(colorizedChannel);
  const deviceModelManager = new DeviceModelManager(context, colorizedChannel);
  const modelRepositoryManager = new ModelRepositoryManager(context, Constants.WEB_VIEW_PATH, colorizedChannel);

  DigitalTwinUtility.init(modelRepositoryManager, outputChannel);
  initIntelliSense(context, telemetryWorker);
  initDigitalTwinCommand(
    context,
    telemetryWorker,
    colorizedChannel,
    true,
    Command.CreateInterface,
    async (): Promise<void> => {
      return deviceModelManager.createModel(ModelType.Interface);
    }
  );
  initDigitalTwinCommand(
    context,
    telemetryWorker,
    colorizedChannel,
    true,
    Command.CreateCapabilityModel,
    async (): Promise<void> => {
      return deviceModelManager.createModel(ModelType.CapabilityModel);
    }
  );
  initDigitalTwinCommand(
    context,
    telemetryWorker,
    colorizedChannel,
    true,
    Command.OpenRepository,
    async (): Promise<void> => {
      return modelRepositoryManager.signIn();
    }
  );
  initDigitalTwinCommand(
    context,
    telemetryWorker,
    colorizedChannel,
    true,
    Command.SignOutRepository,
    async (): Promise<void> => {
      return modelRepositoryManager.signOut();
    }
  );
  initDigitalTwinCommand(
    context,
    telemetryWorker,
    colorizedChannel,
    true,
    Command.SubmitFiles,
    async (telemetryContext: TelemetryContext): Promise<void> => {
      return modelRepositoryManager.submitFiles(telemetryContext);
    }
  );
  initDigitalTwinCommand(
    context,
    telemetryWorker,
    colorizedChannel,
    false,
    Command.DeleteModels,
    async (publicRepository: boolean, modelIds: string[]): Promise<void> => {
      return modelRepositoryManager.deleteModels(publicRepository, modelIds);
    }
  );
  initDigitalTwinCommand(
    context,
    telemetryWorker,
    colorizedChannel,
    false,
    Command.DownloadModels,
    async (publicRepository: boolean, modelIds: string[]): Promise<void> => {
      return modelRepositoryManager.downloadModels(publicRepository, modelIds);
    }
  );
  initDigitalTwinCommand(
    context,
    telemetryWorker,
    colorizedChannel,
    false,
    Command.SearchInterface,
    async (
      publicRepository: boolean,
      keyword?: string,
      pageSize?: number,
      continuationToken?: string
    ): Promise<SearchResult> => {
      return modelRepositoryManager.searchModel(
        ModelType.Interface,
        publicRepository,
        keyword,
        pageSize,
        continuationToken
      );
    }
  );
  initDigitalTwinCommand(
    context,
    telemetryWorker,
    colorizedChannel,
    false,
    Command.SearchCapabilityModel,
    async (
      publicRepository: boolean,
      keyword?: string,
      pageSize?: number,
      continuationToken?: string
    ): Promise<SearchResult> => {
      return modelRepositoryManager.searchModel(
        ModelType.CapabilityModel,
        publicRepository,
        keyword,
        pageSize,
        continuationToken
      );
    }
  );
}

function enableUsbDetector(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): void {
  if (RemoteExtension.isRemote(context)) {
    return;
  }
  // delay to detect usb
  const usbDetectorModule = importLazy(() => require("./usbDetector"))();

  const usbDetector = new usbDetectorModule.UsbDetector(context, outputChannel);
  usbDetector.startListening(context);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  printHello(context);

  const channelName = "Azure IoT Device Workbench";
  const outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel(channelName);
  telemetryWorker = TelemetryWorker.getInstance(context);
  context.subscriptions.push(telemetryWorker);

  // Load iot Project here and do not ask to new an iot project when no iot
  // project open since no command has been triggered yet.
  const telemetryContext = telemetryWorker.createContext();
  await constructAndLoadIoTProject(context, outputChannel, telemetryContext, true);

  const deviceOperator = new DeviceOperator();
  const azureOperator = new AzureOperator();
  const exampleExplorer = new exampleExplorerModule.ExampleExplorer();

  initCommandWithTelemetry(
    context,
    telemetryWorker,
    outputChannel,
    WorkbenchCommands.InitializeProject,
    EventNames.createNewProjectEvent,
    true,
    async (
      context: vscode.ExtensionContext,
      outputChannel: vscode.OutputChannel,
      telemetryContext: TelemetryContext
    ): Promise<void> => {
      const projectInitializer = new ProjectInitializer();
      return projectInitializer.InitializeProject(context, outputChannel, telemetryContext);
    }
  );

  initCommandWithTelemetry(
    context,
    telemetryWorker,
    outputChannel,
    WorkbenchCommands.ConfigureProjectEnvironment,
    EventNames.configProjectEnvironmentEvent,
    true,
    async (
      context: vscode.ExtensionContext,
      outputChannel: vscode.OutputChannel,
      telemetryContext: TelemetryContext
    ): Promise<void> => {
      const projectEnvConfiger = new ProjectEnvironmentConfiger();
      return projectEnvConfiger.configureCmakeProjectEnvironment(context, outputChannel, telemetryContext);
    }
  );

  initCommandWithTelemetry(
    context,
    telemetryWorker,
    outputChannel,
    WorkbenchCommands.AzureProvision,
    EventNames.azureProvisionEvent,
    true,
    async (
      context: vscode.ExtensionContext,
      outputChannel: vscode.OutputChannel,
      telemetryContext: TelemetryContext
    ): Promise<void> => {
      return azureOperator.provision(context, outputChannel, telemetryContext);
    }
  );

  initCommandWithTelemetry(
    context,
    telemetryWorker,
    outputChannel,
    WorkbenchCommands.AzureDeploy,
    EventNames.azureDeployEvent,
    true,
    async (
      context: vscode.ExtensionContext,
      outputChannel: vscode.OutputChannel,
      telemetryContext: TelemetryContext
    ): Promise<void> => {
      return azureOperator.deploy(context, outputChannel, telemetryContext);
    }
  );

  initCommandWithTelemetry(
    context,
    telemetryWorker,
    outputChannel,
    WorkbenchCommands.DeviceCompile,
    EventNames.deviceCompileEvent,
    true,
    async (
      context: vscode.ExtensionContext,
      outputChannel: vscode.OutputChannel,
      telemetryContext: TelemetryContext
    ): Promise<void> => {
      return deviceOperator.compile(context, outputChannel, telemetryContext);
    }
  );

  initCommandWithTelemetry(
    context,
    telemetryWorker,
    outputChannel,
    WorkbenchCommands.DeviceUpload,
    EventNames.deviceUploadEvent,
    true,
    async (
      context: vscode.ExtensionContext,
      outputChannel: vscode.OutputChannel,
      telemetryContext: TelemetryContext
    ): Promise<void> => {
      return deviceOperator.upload(context, outputChannel, telemetryContext);
    }
  );

  initCommandWithTelemetry(
    context,
    telemetryWorker,
    outputChannel,
    WorkbenchCommands.ConfigureDevice,
    EventNames.configDeviceSettingsEvent,
    true,
    async (
      context: vscode.ExtensionContext,
      outputChannel: vscode.OutputChannel,
      telemetryContext: TelemetryContext
    ): Promise<void> => {
      return deviceOperator.configDeviceSettings(context, outputChannel, telemetryContext);
    }
  );

  initCommandWithTelemetry(
    context,
    telemetryWorker,
    outputChannel,
    WorkbenchCommands.Examples,
    EventNames.openExamplePageEvent,
    true,
    async (
      context: vscode.ExtensionContext,
      _outputChannel: vscode.OutputChannel,
      telemetryContext: TelemetryContext
    ): Promise<void> => {
      return exampleExplorer.selectBoard(context, telemetryContext);
    }
  );

  initCommandWithTelemetry(
    context,
    telemetryWorker,
    outputChannel,
    WorkbenchCommands.ExampleInitialize,
    EventNames.loadExampleEvent,
    true,
    async (
      context: vscode.ExtensionContext,
      outputChannel: vscode.OutputChannel,
      telemetryContext: TelemetryContext,
      name?: string,
      url?: string,
      boardId?: string
    ): Promise<void> => {
      return exampleExplorer.initializeExample(context, outputChannel, telemetryContext, name, url, boardId);
    }
  );

  initCommandWithTelemetry(
    context,
    telemetryWorker,
    outputChannel,
    WorkbenchCommands.SendTelemetry,
    EventNames.openTutorial,
    true,
    async () => {
      // Do nothing.
    }
  );

  initCommandWithTelemetry(
    context,
    telemetryWorker,
    outputChannel,
    WorkbenchCommands.IotPnPGenerateCode,
    EventNames.scaffoldDeviceStubEvent,
    true,
    async (
      context: vscode.ExtensionContext,
      outputChannel: vscode.OutputChannel,
      telemetryContext: TelemetryContext
    ): Promise<void> => {
      const codeGenerator = new CodeGeneratorCore();
      return codeGenerator.generateDeviceCodeStub(context, outputChannel, telemetryContext);
    }
  );

  initCommandWithTelemetry(
    context,
    telemetryWorker,
    outputChannel,
    WorkbenchCommands.Help,
    EventNames.help,
    true,
    async () => {
      const boardId = ConfigHandler.get<string>(ConfigKey.boardId);

      if (boardId) {
        const boardListFolderPath = context.asAbsolutePath(
          path.join(FileNames.resourcesFolderName, FileNames.templatesFolderName)
        );
        const boardProvider = new BoardProvider(boardListFolderPath);
        const board = boardProvider.find({ id: boardId });

        if (board && board.helpUrl) {
          await vscode.commands.executeCommand(VscodeCommands.VscodeOpen, vscode.Uri.parse(board.helpUrl));
          return;
        }
      }
      const workbenchHelpUrl = "https://github.com/microsoft/vscode-iot-workbench/blob/master/README.md";
      await vscode.commands.executeCommand(VscodeCommands.VscodeOpen, vscode.Uri.parse(workbenchHelpUrl));
      return;
    }
  );

  initCommandWithTelemetry(
    context,
    telemetryWorker,
    outputChannel,
    WorkbenchCommands.Workbench,
    EventNames.setProjectDefaultPath,
    true,
    async () => {
      RemoteExtension.ensureLocalBeforeRunCommand("set default project path", context);
      const settings = await IoTWorkbenchSettings.getInstance();
      await settings.setWorkbenchPath();
      return;
    }
  );

  initCommand(context, WorkbenchCommands.OpenUri, async (uri: string) => {
    vscode.commands.executeCommand(VscodeCommands.VscodeOpen, vscode.Uri.parse(uri));
  });

  initCommand(context, WorkbenchCommands.HttpRequest, async (uri: string) => {
    const res = await request(uri);
    return res;
  });

  // delay to detect usb
  setTimeout(() => {
    enableUsbDetector(context, outputChannel);
  }, 200);

  // init DigitalTwin part
  initDigitalTwin(context, outputChannel);
}

// this method is called when your extension is deactivated
export async function deactivate(): Promise<void> {
  // Do nothing.
}
