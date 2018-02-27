import {port} from '_debugger';
import * as fs from 'fs-plus';
import * as _ from 'lodash';
import * as opn from 'opn';
import * as os from 'os';
import * as path from 'path';
import {resolve} from 'url';
import {error} from 'util';
import * as vscode from 'vscode';
import * as WinReg from 'winreg';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, DeviceConfig} from '../constants';
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
  iotdevprojectFileName: '.iotdevproject',
  boardInfo: 'AZ3166:stm32f4:MXCHIP_AZ3166',
  uploadMethod: 'upload_method=OpenOCDMethod',
  resourcesFolderName: 'resources',
  cppPropertiesFileName: 'c_cpp_properties.json',
  cppPropertiesFileNameMac: 'c_cpp_properties_macos.json',
  cppPropertiesFileNameWin: 'c_cpp_properties_win32.json',
};

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
                constants.resourcesFolderName,
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
                constants.resourcesFolderName,
                constants.cppPropertiesFileNameMac));
        const propertiesContentMac =
            fs.readFileSync(propertiesFilePathMac).toString();
        fs.writeFileSync(cppPropertiesFilePath, propertiesContentMac);
      }
    } catch (error) {
      throw new Error(`Create cpp properties file failed: ${error.message}`);
    }

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
      const iotdevprojectFilePath =
          path.join(deviceFolderPath, constants.iotdevprojectFileName);
      fs.writeFileSync(iotdevprojectFilePath, ' ');
    } catch (error) {
      throw new Error(
          `Device: create iotdevproject file failed: ${error.message}`);
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
      ignoreFocusOut: true
    };

    await vscode.window.showInputBox(option).then(val => {
      let sketchFileName: string = constants.defaultSketchFileName;
      if (val !== undefined) {
        const fileExt = val.split('.').pop();
        if (fileExt !== 'ino') {
          val = val + '.ino';
        }
        sketchFileName = val;
      }

      // Create arduino.json config file
      const arduinoJSONFilePath =
          path.join(vscodeFolderPath, constants.arduinoJsonFileName);
      const arduinoJSONObj = {
        'board': constants.boardInfo,
        'sketch': sketchFileName,
        'configuration': constants.uploadMethod
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
      const settingsJSONObj = {'files.exclude': {'.build': true}};

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
      const sketchTemplateFilePath = this.extensionContext.asAbsolutePath(
          path.join(constants.resourcesFolderName, this.sketchName));
      const newSketchFilePath = path.join(deviceFolderPath, sketchFileName);

      try {
        const content = fs.readFileSync(sketchTemplateFilePath).toString();
        fs.writeFileSync(newSketchFilePath, content);
        if (newSketchFilePath) {
          const newFileUri: vscode.Uri = vscode.Uri.file(newSketchFilePath);
          vscode.window.showTextDocument(newFileUri);
        }
      } catch (error) {
        throw new Error(`Create arduino sketch file failed: ${error.message}`);
      }
    });

    return true;
  }

  async compile(): Promise<boolean> {
    try {
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

      await vscode.commands.executeCommand('arduino.upload');
      return true;
    } catch (error) {
      throw error;
    }
  }

  async setDeviceConnectionString(): Promise<boolean> {
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

      const deviceConnectionStringSelection: vscode.QuickPickItem[] = [
        {
          label: 'Select IoT Hub Device Connection String',
          description: `Device Information: ${hostName} ${deviceId}`,
          detail: 'select'
        },
        {
          label: 'Input IoT Hub Device Connection String',
          description: 'input another...',
          detail: 'input'
        }
      ];

      const selection =
          await vscode.window.showQuickPick(deviceConnectionStringSelection, {
            ignoreFocusOut: true,
            placeHolder: 'Choose IoT Hub Device Connection String'
          });

      if (!selection) {
        return false;
      }

      if (selection.detail === 'input') {
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
              'The format of the IoT Hub Device connection string is invalid.');
        }
      }

      if (!deviceConnectionString) {
        return false;
      }

      console.log(deviceConnectionString);

      // Set selected connection string to device
      const res =
          await this.flushDeviceConnectionString(deviceConnectionString);
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
                com.vendorId === DeviceConfig.az3166ComPortVendorId &&
                com.productId.toLowerCase() ===
                    DeviceConfig.az3166ComPortProductId) {
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
}
