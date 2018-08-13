// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {Client} from 'azure-iot-device';
import {Message, TwinProperties} from 'azure-iot-device';
import {Mqtt} from 'azure-iot-device-mqtt';
import * as cp from 'child_process';
import * as fs from 'fs-plus';
import * as path from 'path';
import {print} from 'util';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, FileNames} from '../constants';

import {ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';
import {ActionPair, DeviceReceiveAction, DeviceReport, DeviceTwin, MessageSend, MessageVariable, SimulateFile} from './Interfaces/SimulateFile';

const constants = {
  defaultSketchFileName: 'app.js'
};

interface ValueDictionary {
  [name: string]: string;
}

export async function simulatorRun() {
  if (vscode.workspace.rootPath === undefined) {
    throw new Error('Unable to find the path');
  }
  if (!vscode.workspace.workspaceFolders) {
    throw new Error(
        'Unable to find the root path, please open an IoT Workbench project');
  }
  const currentPath = vscode.workspace.rootPath;
  if (fs.existsSync(path.join(currentPath, 'config.json')) === false) {
    throw new Error('Config file not exist!');
  }
  const configFile = require(path.join(currentPath, 'config.json'));
  const connectionString = configFile.connectionString;
  const execFile = configFile.main;
  if (connectionString === undefined) {
    throw new Error('Connection string not set');
  }
  const deviceIDMatches = connectionString.match(/DeviceId=(.*?)(;|$)/);
  let deviceId = deviceIDMatches[0];
  deviceId = deviceId.replace('DeviceId=', '');
  deviceId = deviceId.replace(';', '');
  const client = Client.fromConnectionString(connectionString, Mqtt);
  if (execFile === undefined) {
    throw new Error('Main config file not set');
  }
  if (fs.existsSync(path.join(currentPath, execFile)) === false) {
    throw new Error('Main config file not found');
  }
  const mainConfigSimulateFile = require(path.join(currentPath, execFile));
  await processSimulateFile(mainConfigSimulateFile, client, deviceId);
}

async function processSimulateFile(
    mainConfigSimulateFile: SimulateFile, client: Client, deviceId: string) {
  const message = mainConfigSimulateFile.Message;
  const receive = mainConfigSimulateFile.Receive;
  if (receive !== undefined) {
    if (receive.Message !== undefined) {
      dealReceiveMessage(receive.Message, client);
    }
    if (receive.Twin !== undefined) {
      dealDesiredProperty(receive.Twin, client);
    }
  }
  console.log(`${deviceId}: Start listening for C2D messages...`);
  client.on('message', (msg: Message) => {
    console.log('Receive message from cloud: ' + msg.data);
  });
  console.log(`${deviceId}: Start monitoring desired property of twin...`);
  client.getTwin((err, twin) => {
    if (err || twin === undefined) {
      console.error('Could not get twin');
    } else {
      twin.on('properties.desired', (delta: ValueDictionary) => {
        console.log(`${deviceId}: new desired properties received:`);
        console.log(`${deviceId}: ` + JSON.stringify(delta));
      });
    }
  });
  if (message !== undefined) {
    sendMessage(message, client, deviceId);
  }
  const twin = mainConfigSimulateFile.Twin;
  if (twin !== undefined) {
    sendTwin(twin, client, deviceId);
  }
}

async function dealReceiveMessage(
    message: DeviceReceiveAction, client: Client) {
  client.on('message', (msg: Message) => {
    if (message.Equal !== undefined) {
      for (const pair of message.Equal) {
        if (pair.Value === msg.data.toString()) {
          if (pair.Send === undefined) {
            return;
          }
          const messageToSend = new Message(pair.Send);
          client.open(() => {
            client.sendEvent(
                messageToSend,
            );
          });
        }
      }
    }
    if (message.Smaller !== undefined) {
      for (const pair of message.Smaller) {
        if (pair.Value !== undefined && pair.Value > msg.data.toString()) {
          if (pair.Send === undefined) {
            return;
          }
          const messageToSend = new Message(pair.Send);
          client.open(() => {
            client.sendEvent(
                messageToSend,
            );
          });
        }
      }
    }
    if (message.Larger !== undefined) {
      for (const pair of message.Larger) {
        if (pair.Value !== undefined && pair.Value < msg.data.toString()) {
          if (pair.Send === undefined) {
            return;
          }
          const messageToSend = new Message(pair.Send);
          client.open(() => {
            client.sendEvent(
                messageToSend,
            );
          });
        }
      }
    }
  });
}

async function dealDesiredProperty(
    desired: DeviceReceiveAction, client: Client) {
  client.getTwin((err, twin) => {
    if (err || twin === undefined) {
      console.error('Could not get twin');
    } else {
      twin.on('properties.desired', (delta: ValueDictionary) => {
        if (desired.Equal !== undefined) {
          for (const pair of desired.Equal) {
            if (pair.Property !== undefined) {
              if (delta[pair.Property] === pair.Value) {
                if (pair.Send === undefined) {
                  return;
                }
                const messageToSend = new Message(pair.Send);
                client.open(() => {
                  client.sendEvent(
                      messageToSend,
                  );
                });
              }
            }
          }
        }
        if (desired.Smaller !== undefined) {
          for (const pair of desired.Smaller) {
            if (pair.Property !== undefined && pair.Value !== undefined) {
              if (delta[pair.Property] < pair.Value) {
                if (pair.Send === undefined) {
                  return;
                }
                const messageToSend = new Message(pair.Send);
                client.open(() => {
                  client.sendEvent(
                      messageToSend,
                  );
                });
              }
            }
          }
        }
        if (desired.Larger !== undefined) {
          for (const pair of desired.Larger) {
            if (pair.Property !== undefined && pair.Value !== undefined) {
              if (delta[pair.Property] < pair.Value) {
                if (pair.Send === undefined) {
                  return;
                }
                const messageToSend = new Message(pair.Send);
                client.open(() => {
                  client.sendEvent(
                      messageToSend,
                  );
                });
              }
            }
          }
        }
      });
    }
  });
}

async function sendMessage(
    message: MessageSend, client: Client, deviceId: string) {
  const messageInterval = message.Interval;
  if (messageInterval === undefined) {
    client.open(() => {
      const parsedMessage = parseMessage(message.Content, message.Variable);
      const messageToSend = new Message(parsedMessage);
      console.log(`${deviceId}: Sending message: ${parsedMessage}`);
      client.sendEvent(
          messageToSend,
      );
    });
  } else {
    client.open(() => setInterval(() => {
                  const parsedMessage =
                      parseMessage(message.Content, message.Variable);
                  const messageToSend = new Message(parsedMessage);
                  console.log(`${deviceId}: Sending message: ${parsedMessage}`);
                  client.sendEvent(
                      messageToSend,
                  );
                }, messageInterval));
  }
}

function parseMessage(
    messageContent: string, messageVariable: MessageVariable[]|undefined) {
  if (messageVariable === undefined) {
    return messageContent;
  }
  const translatedVarible: ValueDictionary = {};
  messageVariable.forEach((variable: MessageVariable) => {
    let value = '';
    if (variable.Equal !== undefined) {
      value = String(variable.Equal);
    } else {
      let min = 0;
      let max = 0;
      if (variable.Min !== undefined) {
        min = variable.Min;
      }
      if (variable.Max !== undefined) {
        max = variable.Max;
      }
      value = String(Math.random() * (max - min + 1) + min);
    }
    if (variable.Digits !== undefined) {
      value = Number(value).toFixed(variable.Digits);
    }
    translatedVarible[variable.Name] = value;
  });
  let variableStartPosition = messageContent.indexOf('{{');
  let variableEndPosition = messageContent.indexOf('}}');
  while (variableEndPosition !== -1 && variableStartPosition !== -1 &&
         translatedVarible[messageContent.substr(
             variableStartPosition + 2,
             variableEndPosition - variableStartPosition - 2)] !== undefined) {
    messageContent = messageContent.replace(
        messageContent.substr(
            variableStartPosition,
            variableEndPosition - variableStartPosition + 2),
        translatedVarible[messageContent.substr(
            variableStartPosition + 2,
            variableEndPosition - variableStartPosition - 2)]);
    variableStartPosition = messageContent.indexOf('{{');
    variableEndPosition = messageContent.indexOf('}}');
  }
  return messageContent;
}

async function sendTwin(twin: DeviceTwin, client: Client, deviceId: string) {
  const report = twin.Report;
  if (report === undefined) {
    return;
  }
  const reportContent = report.Content;
  if (reportContent === undefined) {
    return;
  }
  const reportInterval = report.Interval;
  client.getTwin((err, twin) => {
    if (err || twin === undefined) {
      console.error(`${deviceId}: could not get twin`);
    } else {
      console.log(`${deviceId}: twin created`);
      if (reportInterval === undefined) {
        const parsedReportContent =
            parseReportContent(reportContent, report.Variable);
        twin.properties.reported.update(parsedReportContent, () => {
          if (err) throw err;
          console.log(`${deviceId}: twin state reported`);
        });
      } else {
        setInterval(() => {
          const parsedReportContent =
              parseReportContent(reportContent, report.Variable);
          twin.properties.reported.update(parsedReportContent, () => {
            if (err) throw err;
            console.log(`${deviceId}: twin state reported`);
          });
        }, reportInterval);
      }
    }
  });
}

function parseReportContent(
    reportContent: {}|undefined,
    messageVariable: MessageVariable[]|undefined): {} {
  const reportContentObject = JSON.parse(JSON.stringify(reportContent));
  for (const elementName in reportContentObject) {
    if (typeof reportContentObject[elementName] === 'object') {
      reportContentObject[elementName] =
          parseReportContent(reportContentObject[elementName], messageVariable);
    } else if (typeof reportContentObject[elementName] === 'string') {
      reportContentObject[elementName] =
          parseMessage(reportContentObject[elementName], messageVariable);
    }
  }
  return reportContentObject;
}

export class Simulator implements Device {
  private deviceType: DeviceType;
  private componentType: ComponentType;
  private deviceFolder: string;
  private extensionContext: vscode.ExtensionContext;
  private channel: vscode.OutputChannel;
  private sketchName = '';
  private static _boardId = 'simulator';
  name = 'Simulator';
  private componentId: string;
  get id() {
    return this.componentId;
  }
  constructor(
      context: vscode.ExtensionContext, devicePath: string,
      channel: vscode.OutputChannel, sketchName?: string) {
    this.deviceType = DeviceType.Simulator;
    this.componentType = ComponentType.Device;
    this.deviceFolder = devicePath;
    this.extensionContext = context;
    this.channel = channel;
    this.componentId = 'aaa';
    if (sketchName) {
      this.sketchName = sketchName;
    }
  }
  static get boardId() {
    return Simulator._boardId;
  }
  getDeviceType(): DeviceType {
    return this.deviceType;
  }
  getComponentType(): ComponentType {
    return this.componentType;
  }
  async compile(): Promise<boolean> {
    await vscode.window.showInformationMessage(
        'Compiling device code for Simualtor is not supported');
    return true;
  }
  async upload(): Promise<boolean> {
    await vscode.window.showInformationMessage(
        'Upload device code for Simulator is not supported');
    return true;
  }
  async load(): Promise<boolean> {
    const deviceFolderPath = this.deviceFolder;

    if (!fs.existsSync(deviceFolderPath)) {
      throw new Error('Unable to find the device folder inside the project.');
    }

    return true;
  }

  async create(): Promise<boolean> {
    const deviceFolderPath = this.deviceFolder;

    if (!fs.existsSync(deviceFolderPath)) {
      throw new Error('Unable to find the device folder inside the project.');
    }

    try {
      const iotworkbenchprojectFilePath =
          path.join(deviceFolderPath, FileNames.iotworkbenchprojectFileName);
      fs.writeFileSync(iotworkbenchprojectFilePath, ' ');
    } catch (error) {
      throw new Error(
          `Device: create iotworkbenchproject file failed: ${error.message}`);
    }

    const vscodeFolderPath =
        path.join(deviceFolderPath, FileNames.vscodeSettingsFolderName);
    if (!fs.existsSync(vscodeFolderPath)) {
      fs.mkdirSync(vscodeFolderPath);
    }

    const option: vscode.InputBoxOptions = {
      value: constants.defaultSketchFileName,
      prompt: `Please input device sketch file name here.`,
      ignoreFocusOut: true,
      validateInput: (sketchFileName: string) => {
        if (!sketchFileName ||
            /^([a-z_]|[a-z_][-a-z0-9_.]*[a-z0-9_])(\.js)?$/i.test(
                sketchFileName)) {
          return '';
        }
        return 'Sketch file name can only contain alphanumeric and cannot start with number.';
      }
    };

    let sketchFileName = await vscode.window.showInputBox(option);

    if (sketchFileName === undefined) {
      return false;
    } else if (!sketchFileName) {
      sketchFileName = constants.defaultSketchFileName;
    } else {
      sketchFileName = sketchFileName.trim();
      if (!/\.js$/i.test(sketchFileName)) {
        sketchFileName += '.js';
      }
    }

    const sketchTemplateFilePath =
        this.extensionContext.asAbsolutePath(path.join(
            FileNames.resourcesFolderName, Simulator.boardId, this.sketchName));
    const newSketchFilePath = path.join(deviceFolderPath, sketchFileName);

    try {
      const content = fs.readFileSync(sketchTemplateFilePath).toString();
      fs.writeFileSync(newSketchFilePath, content);
    } catch (error) {
      throw new Error(`Create ${sketchFileName} failed: ${error.message}`);
    }

    const packageTemplateFilePath =
        this.extensionContext.asAbsolutePath(path.join(
            FileNames.resourcesFolderName, Simulator.boardId, 'package.json'));
    const newPackageFilePath = path.join(deviceFolderPath, 'package.json');

    try {
      const packageObj = require(packageTemplateFilePath);
      packageObj.main = sketchFileName;
      fs.writeFileSync(newPackageFilePath, JSON.stringify(packageObj, null, 2));
    } catch (error) {
      throw new Error(`Create package.json failed: ${error.message}`);
    }

    const settingsJSONFilePath =
        path.join(vscodeFolderPath, FileNames.settingsJsonFileName);
    const settingsJSONObj = {'files.exclude': {'.iotworkbenchproject': true}};

    try {
      fs.writeFileSync(
          settingsJSONFilePath, JSON.stringify(settingsJSONObj, null, 4));
    } catch (error) {
      throw new Error(`Device: create config file failed: ${error.message}`);
    }

    cp.exec('npm install', {cwd: deviceFolderPath});

    return true;
  }
  async configDeviceSettings(): Promise<boolean> {
    try {
      const res = await this.configHub();
      return res;
    } catch (error) {
      vscode.window.showWarningMessage('Config IoT Hub failed.');
      return false;
    }
  }


  async configHub(): Promise<boolean> {
    try {
      const deviceFolderPath = this.deviceFolder;

      if (!fs.existsSync(deviceFolderPath)) {
        throw new Error('Unable to find the device folder inside the project.');
      }

      // Get IoT Hub device connection string from config
      let deviceConnectionString =
          ConfigHandler.get<string>(ConfigKey.iotHubDeviceConnectionString);

      let hostName = '';
      let deviceId = '';
      if (deviceConnectionString) {
        const hostnameMatches =
            deviceConnectionString.match(/HostName=(.*?)(;|$)/);
        if (hostnameMatches) {
          hostName = hostnameMatches[0];
        }

        const deviceIDMatches =
            deviceConnectionString.match(/DeviceId=(.*?)(;|$)/);
        if (deviceIDMatches) {
          deviceId = deviceIDMatches[0];
        }
      }

      let deviceConnectionStringSelection: vscode.QuickPickItem[] = [];
      if (deviceId && hostName) {
        deviceConnectionStringSelection = [
          {
            label: 'Select IoT Hub Device Connection String',
            description: '',
            detail: `Device Information: ${hostName} ${deviceId}`
          },
          {
            label: 'Input IoT Hub Device Connection String',
            description: '',
            detail: 'Input another...'
          }
        ];
      } else {
        deviceConnectionStringSelection = [{
          label: 'Input IoT Hub Device Connection String',
          description: '',
          detail: 'Input another...'
        }];
      }

      const selection =
          await vscode.window.showQuickPick(deviceConnectionStringSelection, {
            ignoreFocusOut: true,
            placeHolder: 'Choose IoT Hub Device Connection String'
          });

      if (!selection) {
        return false;
      }

      if (selection.detail === 'Input another...') {
        const option: vscode.InputBoxOptions = {
          value:
              'HostName=<Host Name>;DeviceId=<Device Name>;SharedAccessKey=<Device Key>',
          prompt: `Please input device connection string here.`,
          ignoreFocusOut: true
        };

        deviceConnectionString = await vscode.window.showInputBox(option);
        if (!deviceConnectionString) {
          return false;
        }
        if ((deviceConnectionString.indexOf('HostName') === -1) ||
            (deviceConnectionString.indexOf('DeviceId') === -1) ||
            (deviceConnectionString.indexOf('SharedAccessKey') === -1)) {
          throw new Error(
              'The format of the IoT Hub Device connection string is invalid. Please provide a valid Device connection string.');
        }
      }

      if (!deviceConnectionString) {
        return false;
      }

      console.log(deviceConnectionString);

      const configFilePath = path.join(deviceFolderPath, 'config.json');
      if (fs.existsSync(configFilePath) === false) {
        throw new Error('Config file not exist!');
      }
      const configFile = require(configFilePath);
      // Set selected connection string to device
      try {
        configFile.connectionString = deviceConnectionString;
        fs.writeFileSync(configFilePath, JSON.stringify(configFile, null, 2));
      } catch (error) {
        throw new Error(
            `Device: config connection string failed: ${error.message}`);
      }

      vscode.window.showInformationMessage(
          'Configure Device connection string successfully.');
      return true;
    } catch (error) {
      throw error;
    }
  }
}