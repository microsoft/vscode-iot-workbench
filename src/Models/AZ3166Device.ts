// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {port} from '_debugger';
import {exec} from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs-plus';
import * as getmac from 'getmac';
import * as _ from 'lodash';
import * as opn from 'opn';
import * as os from 'os';
import * as path from 'path';
import {SerialPortLite} from 'serialport-lite';
import {resolve} from 'url';
import {error} from 'util';
import * as vscode from 'vscode';
import * as WinReg from 'winreg';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, DeviceConfig, FileNames} from '../constants';
import {DialogResponses} from '../DialogResponses';
import {ProjectTemplate, ProjectTemplateType} from '../Models/Interfaces/ProjectTemplate';
import {IoTProject} from '../Models/IoTProject';
import {delay, getRegistryValues} from '../utils';

import {Component, ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';

interface SerialPortInfo {
  comName: string;
  manufacturer: string;
  vendorId: string;
  productId: string;
}

const constants = {
  vscodeSettingsFolderName: '.vscode',
  defaultSketchFileName: 'device.ino',
  arduinoJsonFileName: 'arduino.json',
  settingsJsonFileName: 'settings.json',
  boardInfo: 'AZ3166:stm32f4:MXCHIP_AZ3166',
  uploadMethod: 'upload_method=OpenOCDMethod',
  cppPropertiesFileName: 'c_cpp_properties.json',
  cppPropertiesFileNameMac: 'c_cpp_properties_macos.json',
  cppPropertiesFileNameWin: 'c_cpp_properties_win32.json',
  outputPath: './.build',
  platformLocalFileName: 'platform.local.txt',
  cExtraFlag: 'compiler.c.extra_flags=-DCORRELATIONID="',
  cppExtraFlag: 'compiler.cpp.extra_flags=-DCORRELATIONID="',
  traceExtraFlag: ' -DENABLETRACE='
};

async function cmd(command: string) {
  exec(command, Promise.resolve);
}

export class AZ3166Device implements Device {
  // tslint:disable-next-line: no-any
  static get serialport(): any {
    if (!AZ3166Device._serialport) {
      AZ3166Device._serialport =
          require('../../../vendor/node-usb-native').SerialPort;
    }
    return AZ3166Device._serialport;
  }

  // tslint:disable-next-line: no-any
  private static _serialport: any;

  private deviceType: DeviceType;
  private componentType: ComponentType;
  private deviceFolder: string;
  private extensionContext: vscode.ExtensionContext;
  private sketchName = '';
  private static _boardId = 'devkit';

  static get boardId() {
    return AZ3166Device._boardId;
  }

  constructor(
      context: vscode.ExtensionContext, devicePath: string,
      sketchName?: string) {
    this.deviceType = DeviceType.MXChip_AZ3166;
    this.componentType = ComponentType.Device;
    this.deviceFolder = devicePath;
    this.extensionContext = context;
    if (sketchName) {
      this.sketchName = sketchName;
    }
  }

  name = 'AZ3166';

  getDeviceType(): DeviceType {
    return this.deviceType;
  }

  getComponentType(): ComponentType {
    return this.componentType;
  }

  async load(): Promise<boolean> {
    const deviceFolderPath = this.deviceFolder;

    if (!fs.existsSync(deviceFolderPath)) {
      throw new Error(`Device folder doesn't exist: ${deviceFolderPath}`);
    }

    const vscodeFolderPath =
        path.join(deviceFolderPath, constants.vscodeSettingsFolderName);
    if (!fs.existsSync(vscodeFolderPath)) {
      fs.mkdirSync(vscodeFolderPath);
    }

    // Create c_cpp_properties.json file
    const cppPropertiesFilePath =
        path.join(vscodeFolderPath, constants.cppPropertiesFileName);

    if (fs.existsSync(cppPropertiesFilePath)) {
      return true;
    }

    try {
      const plat = os.platform();

      if (plat === 'win32') {
        const propertiesFilePathWin32 =
            this.extensionContext.asAbsolutePath(path.join(
              FileNames.resourcesFolderName, AZ3166Device.boardId,
                constants.cppPropertiesFileNameWin));
        const propertiesContentWin32 =
            fs.readFileSync(propertiesFilePathWin32).toString();
        const pattern = /{ROOTPATH}/gi;
        const localAppData: string = process.env.LOCALAPPDATA;
        const replaceStr = propertiesContentWin32.replace(
            pattern, localAppData.replace(/\\/g, '\\\\'));
        fs.writeFileSync(cppPropertiesFilePath, replaceStr);
      }
      // TODO: Let's use the same file for Linux and MacOS for now. Need to
      // revisit this part.
      else {
        const propertiesFilePathMac =
            this.extensionContext.asAbsolutePath(path.join(
                FileNames.resourcesFolderName, AZ3166Device.boardId,
                constants.cppPropertiesFileNameMac));
        const propertiesContentMac =
            fs.readFileSync(propertiesFilePathMac).toString();
        fs.writeFileSync(cppPropertiesFilePath, propertiesContentMac);
      }
    } catch (error) {
      throw new Error(`Create cpp properties file failed: ${error.message}`);
    }

    // Enable logging on IoT Devkit
    await this.generatePlatformLocal();

    return true;
  }

  async create(): Promise<boolean> {
    if (!this.sketchName) {
      throw new Error('No sketch file found.');
    }
    const deviceFolderPath = this.deviceFolder;

    if (!fs.existsSync(deviceFolderPath)) {
      throw new Error(`Device folder doesn't exist: ${deviceFolderPath}`);
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
        path.join(deviceFolderPath, constants.vscodeSettingsFolderName);
    if (!fs.existsSync(vscodeFolderPath)) {
      fs.mkdirSync(vscodeFolderPath);
    }

    // Get arduino sketch file name from user input or use defalt sketch name
    const option: vscode.InputBoxOptions = {
      value: constants.defaultSketchFileName,
      prompt: `Please input device sketch file name here.`,
      ignoreFocusOut: true,
      validateInput: (sketchFileName: string) => {
        if (!sketchFileName ||
            /^([a-z_]|[a-z_][-a-z0-9_.]*[a-z0-9_])(\.ino)?$/i.test(
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
      if (!/\.ino$/i.test(sketchFileName)) {
        sketchFileName += '.ino';
      }
    }

    // Create arduino.json config file
    const arduinoJSONFilePath =
        path.join(vscodeFolderPath, constants.arduinoJsonFileName);
    const arduinoJSONObj = {
      'board': constants.boardInfo,
      'sketch': sketchFileName,
      'configuration': constants.uploadMethod,
      'output': constants.outputPath
    };

    try {
      fs.writeFileSync(
          arduinoJSONFilePath, JSON.stringify(arduinoJSONObj, null, 4));
    } catch (error) {
      throw new Error(
          `Device: create arduino config file failed: ${error.message}`);
    }

    // Create settings.json config file
    const settingsJSONFilePath =
        path.join(vscodeFolderPath, constants.settingsJsonFileName);
    const settingsJSONObj = {
      'files.exclude': {'.build': true, '.iotworkbenchproject': true},
      'C_Cpp.intelliSenseEngine': 'Tag Parser'
    };

    try {
      fs.writeFileSync(
          settingsJSONFilePath, JSON.stringify(settingsJSONObj, null, 4));
    } catch (error) {
      throw new Error(
          `Device: create arduino config file failed: ${error.message}`);
    }

    // Create c_cpp_properties.json file
    this.load();

    // Create an empty arduino sketch
    const sketchTemplateFilePath =
        this.extensionContext.asAbsolutePath(path.join(
            FileNames.resourcesFolderName, AZ3166Device.boardId,
            this.sketchName));
    const newSketchFilePath = path.join(deviceFolderPath, sketchFileName);

    try {
      const content = fs.readFileSync(sketchTemplateFilePath).toString();
      fs.writeFileSync(newSketchFilePath, content);
    } catch (error) {
      throw new Error(`Create arduino sketch file failed: ${error.message}`);
    }

    return true;
  }

  async compile(): Promise<boolean> {
    try {
      // Enable logging on IoT Devkit
      await this.generatePlatformLocal();

      await vscode.commands.executeCommand('arduino.verify');
      return true;
    } catch (error) {
      throw error;
    }
  }

  async upload(): Promise<boolean> {
    try {
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

      await vscode.commands.executeCommand('arduino.upload');
      return true;
    } catch (error) {
      throw error;
    }
  }

  async configDeviceSettings(): Promise<boolean> {
    try {
      // Get IoT Hub device connection string from config
      let deviceConnectionString =
          ConfigHandler.get<string>(ConfigKey.iotHubDeviceConnectionString);

      let hostName = '';
      let deviceId = '';
      if (deviceConnectionString) {
        const hostnameMatches =
            deviceConnectionString.match(/HostName=(.*?)[;$]/);
        if (hostnameMatches) {
          hostName = hostnameMatches[0];
        }

        const deviceIDMatches =
            deviceConnectionString.match(/DeviceId=(.*?)[;$]/);
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

      // Set selected connection string to device
      let res: boolean;
      const plat = os.platform();
      if (plat === 'win32') {
        res = await this.flushDeviceConnectionString(deviceConnectionString);
      } else {
        res =
            await this.flushDeviceConnectionStringUnix(deviceConnectionString);
      }

      if (res === false) {
        return false;
      } else {
        vscode.window.showInformationMessage(
            'Configure Device connection string successfully.');
        return true;
      }
    } catch (error) {
      throw error;
    }
  }

  async flushDeviceConnectionStringUnix(connectionString: string):
      Promise<boolean> {
    return new Promise(
        async (
            resolve: (value: boolean) => void,
            reject: (reason: Error) => void) => {
          try {
            const list = await SerialPortLite.list();
            let devkitConnected = false;
            for (let i = 0; i < list.length; i++) {
              const device = list[i];
              if (device.vendorId ===
                      Number(`0x${DeviceConfig.az3166ComPortVendorId}`) &&
                  device.productId ===
                      Number(`0x${DeviceConfig.az3166ComPortProductId}`)) {
                devkitConnected = true;
                const screenLogFile = path.join(
                    this.extensionContext.extensionPath, 'screenlog.0');

                const timeoutMessage = setTimeout(async () => {
                  await vscode.window.showInformationMessage(
                      'Please hold down button A and then push and release the reset button to enter configuration mode.');
                  await cmd(
                      `screen -S devkit -p 0 -X stuff \$'\\r\\nhelp\\r\\n'`);
                }, 20000);

                await cmd(`cd ${
                    this.extensionContext
                        .extensionPath} && rm -f screenlog.* && screen -dmSL devkit ${
                    device.port} 115200 && sleep 1`);
                if (!fs.existsSync(screenLogFile)) {
                  await cmd('screen -X -S devkit quit');
                  clearTimeout(timeoutMessage);
                  throw new Error(`Cannot open serial port ${device.port}`);
                }

                await cmd(
                    `screen -S devkit -p 0 -X stuff \$'\\r\\nhelp\\r\\n'`);

                let logs = fs.readFileSync(screenLogFile, 'utf-8');
                if (logs.includes('set_')) {
                  clearTimeout(timeoutMessage);
                  await cmd(
                      'screen -X -S devkit quit && sleep 1 && rm -f screenlog.*');
                  const res = await SerialPortLite.write(
                      device.port, `set_az_iothub "${connectionString}"\r`,
                      115200);
                  return resolve(res);
                } else {
                  fs.watchFile(screenLogFile, async () => {
                    logs = fs.readFileSync(screenLogFile, 'utf-8');

                    if (logs.includes('set_')) {
                      fs.unwatchFile(screenLogFile);
                      clearTimeout(timeoutMessage);
                      await cmd(
                          'screen -X -S devkit quit && sleep 1 && rm -f screenlog.*');
                      const res = await SerialPortLite.write(
                          device.port, `set_az_iothub "${connectionString}"\r`,
                          115200);
                      return resolve(res);
                    }
                  });
                }
              }
            }
            if (!devkitConnected) {
              return resolve(false);
            }
          } catch (error) {
            return resolve(false);
          }
        });
  }

  async flushDeviceConnectionString(connectionString: string):
      Promise<boolean> {
    return new Promise(
        async (
            resolve: (value: boolean) => void,
            reject: (value: Error) => void) => {
          let comPort = '';
          try {
            // Chooes COM port that AZ3166 is connected
            comPort = await this.chooseCOM();
            console.log(`Opening ${comPort}.`);
          } catch (error) {
            reject(error);
          }

          let configMode = false;
          let errorRejected = false;
          let commandExecuted = false;
          let gotData = false;

          const port = new AZ3166Device.serialport(comPort, {
            baudRate: DeviceConfig.defaultBaudRate,
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
              const data = `set_az_iothub "${connectionString}"\r\n`;
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
              _.each(output.split('\n'), line => {
                if (line) {
                  line = _.trimStart(line.trim(), '#').trim();
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
            vscode.window
                .showInformationMessage(
                    'Please hold down button A and then push and release the reset button to enter configuration mode.')
                .then(() => {
                  if (!gotData || !configMode) {
                    // tslint:disable-next-line: no-any
                    port.write('\r\nhelp\r\n', (error: any) => {
                      rejectIfError(error);
                    });
                  }
                });
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
          const list = _.filter(comList, com => {
            if (com.vendorId && com.productId &&
                com.vendorId.toLowerCase().endsWith(
                    DeviceConfig.az3166ComPortVendorId) &&
                com.productId.toLowerCase().endsWith(
                    DeviceConfig.az3166ComPortProductId)) {
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
    const plat = os.platform();

    // TODO: Currently, we do not support portable Arduino installation.
    let _arduinoPackagePath = '';
    if (plat === 'win32') {
      _arduinoPackagePath = path.join(
          process.env['USERPROFILE'], 'AppData', 'Local', 'Arduino15',
          'packages');
    } else if (plat === 'darwin') {
      _arduinoPackagePath =
          path.join(process.env.HOME, 'Library', 'Arduino15', 'packages');
    }

    const arduinoPackagePath =
        path.join(_arduinoPackagePath, 'AZ3166', 'hardware', 'stm32f4');

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
          'Unable to find the Arduino package path, please install the lastest Arduino package for Devkit.');
    }

    const files = fs.readdirSync(arduinoPackagePath);
    for (let i = files.length - 1; i >= 0; i--) {
      if (files[i] === '.DS_Store') {
        files.splice(i, 1);
      }
    }

    if (files.length === 0 || files.length > 1) {
      throw new Error(`There are unexpected files or folders under ${
          arduinoPackagePath}. Please clear the folder and reinstall the package for Devkit.`);
    }

    const directoryName = path.join(arduinoPackagePath, files[0]);
    if (!fs.isDirectorySync(directoryName)) {
      throw new Error(
          'The Arduino package of Devkit is not installed. Please follow the guide to install it');
    }

    const fileName = path.join(directoryName, constants.platformLocalFileName);
    if (!fs.existsSync(fileName)) {
      const enableTrace = 1;
      let hashMacAddress;
      try {
        hashMacAddress = await getHashMacAsync();
      } catch (error) {
        throw error;
      }
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
}
