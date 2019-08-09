// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as crypto from 'crypto';
import * as fs from 'fs-plus';
import * as getmac from 'getmac';
import {Guid} from 'guid-typescript';
import * as _ from 'lodash';
import * as opn from 'opn';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as WinReg from 'winreg';

import {BoardProvider} from '../boardProvider';
import {ConfigHandler} from '../configHandler';
import {ConfigKey} from '../constants';
import {DialogResponses} from '../DialogResponses';
import {delay, getRegistryValues} from '../utils';

import {ArduinoDeviceBase} from './ArduinoDeviceBase';
import {DeviceType} from './Interfaces/Device';
import {TemplateFileInfo} from './Interfaces/ProjectTemplate';

const impor = require('impor')(__dirname);
const forEach = impor('lodash.foreach') as typeof import('lodash.foreach');
const trimStart =
    impor('lodash.trimstart') as typeof import('lodash.trimstart');

interface SerialPortInfo {
  comName: string;
  manufacturer: string;
  vendorId: string;
  productId: string;
}

const constants = {
  outputPath: './.build',
  platformLocalFileName: 'platform.local.txt',
  cExtraFlag: 'compiler.c.extra_flags=-DCORRELATIONID="',
  cppExtraFlag: 'compiler.cpp.extra_flags=-DCORRELATIONID="',
  traceExtraFlag: ' -DENABLETRACE=',
  informationPageUrl: 'https://aka.ms/AA35xln'
};

enum configDeviceOptions {
  ConnectionString,
  UDS
}

export class AZ3166Device extends ArduinoDeviceBase {
  // tslint:disable-next-line: no-any
  static get serialport(): any {
    if (!AZ3166Device._serialport) {
      AZ3166Device._serialport =
          require('../../vendor/node-usb-native').SerialPort;
    }
    return AZ3166Device._serialport;
  }

  // tslint:disable-next-line: no-any
  private static _serialport: any;
  private channel: vscode.OutputChannel;

  private componentId: string;
  get id() {
    return this.componentId;
  }

  private templateFiles: TemplateFileInfo[] = [];
  private static _boardId = 'devkit';

  static get boardId() {
    return AZ3166Device._boardId;
  }

  constructor(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      devicePath: string, templateFiles?: TemplateFileInfo[]) {
    super(context, devicePath, DeviceType.MXChip_AZ3166);
    this.channel = channel;
    this.componentId = Guid.create().toString();
    if (templateFiles) {
      this.templateFiles = templateFiles;
    }
  }

  name = 'AZ3166';

  get board() {
    const boardProvider = new BoardProvider(this.boardFolderPath);
    const az3166 = boardProvider.find({id: AZ3166Device._boardId});
    return az3166;
  }

  get version() {
    const packageRootPath = this.getArduinoPackagePath();
    let version = '0.0.1';

    if (fs.existsSync(packageRootPath)) {
      const versions = fs.readdirSync(packageRootPath);
      if (versions[0]) {
        version = versions[0];
      }
    }

    return version;
  }

  async checkPrerequisites(): Promise<boolean> {
    return super.checkPrerequisites();
  }

  async load(): Promise<boolean> {
    const deviceFolderPath = this.deviceFolder;

    if (!fs.existsSync(deviceFolderPath)) {
      throw new Error('Unable to find the device folder inside the project.');
    }

    if (!this.board) {
      throw new Error('Unable to find the board in the config file.');
    }

    return true;
  }

  async create(): Promise<boolean> {
    return this.createCore(this.board, this.templateFiles);
  }

  async preCompileAction(): Promise<boolean> {
    await this.generatePlatformLocal();
    return true;
  }

  async preUploadAction(): Promise<boolean> {
    const isStlinkInstalled = await this.stlinkDriverInstalled();
    if (!isStlinkInstalled) {
      const message =
          'The ST-LINK driver for DevKit is not installed. Install now?';
      const result: vscode.MessageItem|undefined =
          await vscode.window.showWarningMessage(
              message, DialogResponses.yes, DialogResponses.skipForNow,
              DialogResponses.cancel);
      if (result === DialogResponses.yes) {
        // Open the download page
        const installUri =
            'http://www.st.com/en/development-tools/stsw-link009.html';
        opn(installUri);
        return true;
      } else if (result !== DialogResponses.cancel) {
        return false;
      }
    }
    // Enable logging on IoT Devkit
    await this.generatePlatformLocal();
    return true;
  }

  async configDeviceSettings(): Promise<boolean> {
    const configSelectionItems: vscode.QuickPickItem[] = [
      {
        label: 'Config Device Connection String',
        description: 'Config Device Connection String',
        detail: 'Config Connection String'
      },
      {
        label: 'Config Unique Device String (UDS)',
        description: 'Config Unique Device String (UDS)',
        detail: 'Config UDS'
      },
      {
        label: 'Generate CRC for OTA',
        description:
            'Generate Cyclic Redundancy Check(CRC) code for OTA Update',
        detail: 'Config CRC'
      }
    ];

    const configSelection =
        await vscode.window.showQuickPick(configSelectionItems, {
          ignoreFocusOut: true,
          matchOnDescription: true,
          matchOnDetail: true,
          placeHolder: 'Select an option',
        });

    if (!configSelection) {
      return false;
    }

    if (configSelection.detail === 'Config CRC') {
      const retValue: boolean =
          await this.generateCrc(this.extensionContext, this.channel);
      return retValue;
    } else if (configSelection.detail === 'Config Connection String') {
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
            detail: ''
          }
        ];
      } else {
        deviceConnectionStringSelection = [{
          label: 'Input IoT Hub Device Connection String',
          description: '',
          detail: ''
        }];
      }

      const selection = await vscode.window.showQuickPick(
          deviceConnectionStringSelection,
          {ignoreFocusOut: true, placeHolder: 'Choose an option:'});

      if (!selection) {
        return false;
      }

      if (selection.label === 'Input IoT Hub Device Connection String') {
        const option: vscode.InputBoxOptions = {
          value:
              'HostName=<Host Name>;DeviceId=<Device Name>;SharedAccessKey=<Device Key>',
          prompt: `Please input device connection string here.`,
          ignoreFocusOut: true,
          validateInput: (deviceConnectionString: string) => {
            if (!deviceConnectionString) {
              return 'Please provide a valid device connection string.';
            }

            if ((deviceConnectionString.indexOf('HostName') === -1) ||
                (deviceConnectionString.indexOf('DeviceId') === -1) ||
                (deviceConnectionString.indexOf('SharedAccessKey') === -1)) {
              return 'The format of the IoT Hub Device connection string is invalid.';
            }
            return;
          }
        };

        deviceConnectionString = await vscode.window.showInputBox(option);
        if (!deviceConnectionString) {
          const message =
              'Need more information on how to get device connection string?';
          const result: vscode.MessageItem|undefined =
              await vscode.window.showWarningMessage(
                  message, DialogResponses.yes, DialogResponses.no);
          if (result === DialogResponses.yes) {
            opn(constants.informationPageUrl);
          }
          return false;
        }
      }

      if (!deviceConnectionString) {
        return false;
      }

      console.log(deviceConnectionString);

      // Try to close serial monitor
      try {
        await vscode.commands.executeCommand(
            'arduino.closeSerialMonitor', null, false);
      } catch (ignore) {
      }

      // Set selected connection string to device
      let res: boolean;
      const plat = os.platform();
      if (plat === 'win32') {
        res = await this.flushDeviceConfig(
            deviceConnectionString, configDeviceOptions.ConnectionString);
      } else {
        res = await this.flushDeviceConfigUnix(
            deviceConnectionString, configDeviceOptions.ConnectionString);
      }

      if (res === false) {
        return false;
      } else {
        vscode.window.showInformationMessage(
            'Configure Device connection string completely.');
        return true;
      }
    } else {
      function generateRandomHex(): string {
        const chars = '0123456789abcdef'.split('');
        let hexNum = '';
        for (let i = 0; i < 64; i++) {
          hexNum += chars[Math.floor(Math.random() * 16)];
        }
        return hexNum;
      }

      const option: vscode.InputBoxOptions = {
        value: generateRandomHex(),
        prompt: `Please input Unique Device String (UDS) here.`,
        ignoreFocusOut: true,
        validateInput: (UDS: string) => {
          if (/^([0-9a-f]){64}$/i.test(UDS) === false) {
            return 'The format of the UDS is invalid. Please provide a valid UDS.';
          }
          return '';
        }
      };

      const UDS = await vscode.window.showInputBox(option);

      if (UDS === undefined) {
        return false;
      }

      console.log(UDS);

      // Try to close serial monitor
      try {
        await vscode.commands.executeCommand(
            'arduino.closeSerialMonitor', null, false);
      } catch (ignore) {
      }

      // Set selected connection string to device
      let res: boolean;
      const plat = os.platform();
      if (plat === 'win32') {
        res = await this.flushDeviceConfig(UDS, configDeviceOptions.UDS);
      } else {
        res = await this.flushDeviceConfigUnix(UDS, configDeviceOptions.UDS);
      }

      if (res === false) {
        return false;
      } else {
        vscode.window.showInformationMessage(
            'Configure Unique Device String (UDS) completely.');
        return true;
      }
    }
  }

  async flushDeviceConfigUnix(configValue: string, option: number):
      Promise<boolean> {
    return new Promise(
        async (
            resolve: (value: boolean) => void,
            reject: (value: Error) => void) => {
          let comPort = '';
          let command = '';
          try {
            // Choose COM port that AZ3166 is connected
            comPort = await this.chooseCOM();
            console.log(`Opening ${comPort}.`);
          } catch (error) {
            reject(error);
          }
          if (option === configDeviceOptions.ConnectionString) {
            command = 'set_az_iothub';
          } else {
            command = 'set_dps_uds';
          }
          let errorRejected = false;

          const az3166 = this.board;

          if (!az3166) {
            return reject(
                new Error('IoT DevKit is not found in the board list.'));
          }

          const port = new AZ3166Device.serialport(comPort, {
            baudRate: az3166.defaultBaudRate,
            dataBits: 8,
            stopBits: 1,
            xon: false,
            xoff: false,
            parity: 'none'
          });

          const rejectIfError = (err: Error) => {
            if (errorRejected) return true;
            if (err) {
              errorRejected = true;
              reject(err);
              try {
                port.close();
              } catch (ignore) {
              }
            }

            return true;
          };

          const executeSetAzIoTHub = async () => {
            try {
              const data = `${command} "${configValue}"\r\n`;

              let restDataLength = data.length;
              while (restDataLength > 0) {
                const start = data.length - restDataLength;
                const length = Math.min(100, restDataLength);
                restDataLength -= length;
                const dataChunk = data.substr(start, length);
                await this.sendDataViaSerialPort(port, dataChunk);
                await delay(1000);
              }

              port.close();
            } catch (ignore) {
            }

            if (errorRejected) {
              return;
            } else {
              resolve(true);
            }
          };

          // Configure serial port callbacks
          port.on('open', async () => {
            // tslint:disable-next-line: no-any
            await vscode.window.showInformationMessage(
                'Please hold down button A and then push and release the reset button to enter configuration mode. After enter configuration mode, click OK.',
                'OK');
            executeSetAzIoTHub()
                .then(() => resolve(true))
                .catch((error) => reject(error));
          });

          // tslint:disable-next-line: no-any
          port.on('error', (error: any) => {
            if (errorRejected) return;
            console.log(error);
            rejectIfError(error);
          });
        });
  }

  async flushDeviceConfig(configValue: string, option: number):
      Promise<boolean> {
    return new Promise(
        async (
            resolve: (value: boolean) => void,
            reject: (value: Error) => void) => {
          let comPort = '';
          let command = '';
          try {
            // Choose COM port that AZ3166 is connected
            comPort = await this.chooseCOM();
            console.log(`Opening ${comPort}.`);
          } catch (error) {
            reject(error);
          }
          if (option === configDeviceOptions.ConnectionString) {
            command = 'set_az_iothub';
          } else {
            command = 'set_dps_uds';
          }
          let configMode = false;
          let errorRejected = false;
          let commandExecuted = false;
          let gotData = false;

          const az3166 = this.board;

          if (!az3166) {
            return reject(
                new Error('IoT DevKit is not found in the board list.'));
          }

          const port = new AZ3166Device.serialport(comPort, {
            baudRate: az3166.defaultBaudRate,
            dataBits: 8,
            stopBits: 1,
            xon: false,
            xoff: false,
            parity: 'none'
          });

          const rejectIfError = (err: Error) => {
            if (errorRejected) return true;
            if (err) {
              errorRejected = true;
              reject(err);
              try {
                port.close();
              } catch (ignore) {
              }
            }

            return true;
          };

          const executeSetAzIoTHub = async () => {
            try {
              const data = `${command} "${configValue}"\r\n`;
              await this.sendDataViaSerialPort(port, data.slice(0, 120));
              if (data.length > 120) {
                await delay(1000);
                await this.sendDataViaSerialPort(port, data.slice(120));
              }

              await delay(1000);
              port.close();
            } catch (ignore) {
            }

            if (errorRejected) {
              return;
            } else {
              resolve(true);
            }
          };

          // Configure serial port callbacks
          port.on('open', () => {
            // tslint:disable-next-line: no-any
            port.write('\r\nhelp\r\n', (error: any) => {
              if (rejectIfError(error)) return;
            });
          });

          // tslint:disable-next-line: no-any
          port.on('data', (data: any) => {
            gotData = true;
            const output = data.toString().trim();

            if (commandExecuted) return;
            if (output.includes('set_')) {
              commandExecuted = true;
              configMode = true;
              executeSetAzIoTHub()
                  .then(() => resolve(true))
                  .catch((error) => reject(error));
            } else {
              configMode = false;
            }

            if (configMode) {
              forEach(output.split('\n'), line => {
                if (line) {
                  line = trimStart(line.trim(), '#').trim();
                  if (line && line.length) {
                    console.log('SerialOutput', line);
                  }
                }
              });
            }
          });

          // tslint:disable-next-line: no-any
          port.on('error', (error: any) => {
            if (errorRejected) return;
            console.log(error);
            rejectIfError(error);
          });

          setTimeout(() => {
            if (errorRejected) return;
            // Prompt user to enter configuration mode

            if (!gotData || !configMode) {
              vscode.window
                  .showInformationMessage(
                      'Please hold down button A and then push and release the reset button to enter configuration mode.')
                  .then(() => {
                    // tslint:disable-next-line: no-any
                    port.write('\r\nhelp\r\n', (error: any) => {
                      rejectIfError(error);
                    });
                  });
            }
          }, 10000);
        });
  }

  private getComList(): Promise<SerialPortInfo[]> {
    return new Promise(
        (resolve: (value: SerialPortInfo[]) => void,
         reject: (error: Error) => void) => {
          // tslint:disable-next-line: no-any
          AZ3166Device.serialport.list((e: any, ports: SerialPortInfo[]) => {
            if (e) {
              reject(e);
            } else {
              resolve(ports);
            }
          });
        });
  }

  private async chooseCOM(): Promise<string> {
    return new Promise(
        async (
            resolve: (value: string) => void,
            reject: (reason: Error) => void) => {
          const comList = await this.getComList();

          const az3166 = this.board;

          if (!az3166) {
            return reject(new Error('AZ3166 is not found in the board list.'));
          }

          const list = _.filter(comList, com => {
            if (com.vendorId && com.productId && az3166.vendorId &&
                az3166.productId &&
                com.vendorId.toLowerCase().endsWith(az3166.vendorId) &&
                com.productId.toLowerCase().endsWith(az3166.productId)) {
              return true;
            } else {
              return false;
            }
          });

          if (list && list.length) {
            let comPort = list[0].comName;
            if (list.length > 1) {
              // TODO: select com port from list when there are multiple AZ3166
              // boards connected
              comPort = list[0].comName;
            }

            if (!comPort) {
              reject(new Error('No avalible COM port.'));
            }

            resolve(comPort);
          } else {
            reject(new Error('No AZ3166 board connected.'));
          }
        });
  }

  // tslint:disable-next-line: no-any
  private async sendDataViaSerialPort(port: any, data: string):
      Promise<boolean> {
    return new Promise(
        (resolve: (value: boolean) => void, reject: (value: Error) => void) => {
          try {
            // tslint:disable-next-line: no-any
            port.write(data, (err: any) => {
              if (err) {
                reject(err);
              } else {
                port.drain(() => resolve(true));
              }
            });
          } catch (err) {
            reject(err);
          }
        });
  }

  private async stlinkDriverInstalled() {
    const plat = os.platform();
    if (plat === 'win32') {
      try {
        // The STlink driver would write to the following registry.
        const pathString = await getRegistryValues(
            WinReg.HKLM,
            '\\SYSTEM\\ControlSet001\\Control\\Class\\{88bae032-5a81-49f0-bc3d-a4ff138216d6}',
            'Class');
        if (pathString) {
          return true;
        } else {
          return false;
        }
      } catch (error) {
        return false;
      }
    }
    // For other OS platform, there is no need to install STLink Driver.
    return true;
  }

  private async generatePlatformLocal() {
    const arduinoPackagePath = this.getArduinoPackagePath();

    function getHashMacAsync() {
      return new Promise((resolve) => {
        getmac.getMac((err, macAddress) => {
          if (err) {
            throw (err);
          }
          const hashMacAddress = crypto.createHash('sha256')
                                     .update(macAddress, 'utf8')
                                     .digest('hex');
          resolve(hashMacAddress);
        });
      });
    }

    if (!fs.existsSync(arduinoPackagePath)) {
      throw new Error(
          'Unable to find the Arduino package path, please install the latest Arduino package for Devkit.');
    }

    const files = fs.readdirSync(arduinoPackagePath);
    for (let i = files.length - 1; i >= 0; i--) {
      if (files[i] === '.DS_Store') {
        files.splice(i, 1);
      }
    }

    if (files.length === 0 || files.length > 1) {
      throw new Error(
          'There are unexpected files or folders under Arduino package installation path. Please clear the folder and reinstall the package for Devkit.');
    }

    const directoryName = path.join(arduinoPackagePath, files[0]);
    if (!fs.isDirectorySync(directoryName)) {
      throw new Error(
          'The Arduino package for MXChip IoT Devkit is not installed. Please follow the guide to install it');
    }

    const fileName = path.join(directoryName, constants.platformLocalFileName);
    if (!fs.existsSync(fileName)) {
      const enableTrace = 1;
      let hashMacAddress;
      hashMacAddress = await getHashMacAsync();

      // Create the file of platform.local.txt
      const targetFileName =
          path.join(directoryName, constants.platformLocalFileName);

      const content = `${constants.cExtraFlag}${hashMacAddress}" ${
                          constants.traceExtraFlag}${enableTrace}\r\n` +
          `${constants.cppExtraFlag}${hashMacAddress}" ${
                          constants.traceExtraFlag}${enableTrace}\r\n`;
      try {
        fs.writeFileSync(targetFileName, content);
      } catch (e) {
        throw e;
      }
    }
  }

  private getArduinoPackagePath() {
    const plat = os.platform();

    // TODO: Currently, we do not support portable Arduino installation.
    let arduinoPackagePath = '';
    const homeDir = os.homedir();

    if (plat === 'win32') {
      arduinoPackagePath =
          path.join(homeDir, 'AppData', 'Local', 'Arduino15', 'packages');
    } else if (plat === 'darwin') {
      arduinoPackagePath =
          path.join(homeDir, 'Library', 'Arduino15', 'packages');
    } else if (plat === 'linux') {
      arduinoPackagePath = path.join(homeDir, '.arduino15', 'packages');
    }

    return path.join(arduinoPackagePath, 'AZ3166', 'hardware', 'stm32f4');
  }
}
