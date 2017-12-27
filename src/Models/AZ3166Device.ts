import * as fs from 'fs-plus';
import * as _ from 'lodash';
import * as path from 'path';
import * as SerialPort from 'serialport';
import {resolve} from 'url';
import {error} from 'util';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, DeviceConfig} from '../constants';
import {ExceptionHelper} from '../exceptionHelper';
import {IoTProject, ProjectTemplateType} from '../Models/IoTProject';
import {delay} from '../utils';
import {Component, ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';

const constants = {
  vscodeSettingsFolderName: '.vscode',
  defaultSketchFileName: 'device.ino',
  arduinoJsonFileName: 'arduino.json',
  boardInfo: 'AZ3166:stm32f4:MXCHIP_AZ3166',
  uploadMethod: 'upload_method=OpenOCDMethod',
  resourcesFolderName: 'resources',
  sketchTemplateFileName: 'emptySketch.ino'
};

async function getComList() {
  return new Promise((resolve, reject) => {
    SerialPort.list((e, list) => {
      if (e) {
        reject(e);
      } else {
        resolve(list);
      }
    });
  });
}

async function chooseCOM(): Promise<string> {
  return new Promise(
      async (
          resolve: (value: string) => void,
          reject: (reason: Error) => void) => {
        const comList = await getComList();
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

async function sendDataViaSerialPort(
    port: SerialPort, data: string): Promise<boolean> {
  return new Promise(
      (resolve: (value: boolean) => void, reject: (value: boolean) => void) => {
        try {
          port.write(data, (err) => {
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

export class AZ3166Device implements Device {
  private deviceType: DeviceType;
  private componentType: ComponentType;
  private deviceFolder: string;
  private extensionContext: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext, devicePath: string) {
    this.deviceType = DeviceType.MXChip_AZ3166;
    this.componentType = ComponentType.Device;
    this.deviceFolder = devicePath;
    this.extensionContext = context;
  }

  getDeviceType(): DeviceType {
    return this.deviceType;
  }

  getComponentType(): ComponentType {
    return this.componentType;
  }

  load(): boolean {
    return true;
  }

  create(): boolean {
    const rootPath: string = vscode.workspace.rootPath as string;
    const deviceFolderPath = path.join(rootPath, this.deviceFolder);

    if (!fs.existsSync(deviceFolderPath)) {
      ExceptionHelper.logError(
          `Device folder doesn't exist: ${deviceFolderPath}`, true);
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

    vscode.window.showInputBox(option).then(val => {
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
        ExceptionHelper.logError(
            `Device: create arduino config file failed: ${error.message}`,
            true);
      }

      // Create an empty arduino sketch
      const sketchTemplateFilePath =
          this.extensionContext.asAbsolutePath(path.join(
              constants.resourcesFolderName, constants.sketchTemplateFileName));
      const newSketchFilePath = path.join(deviceFolderPath, sketchFileName);

      try {
        const content = fs.readFileSync(sketchTemplateFilePath).toString();
        fs.writeFileSync(newSketchFilePath, content);
        vscode.commands.executeCommand(
            'arduino.iotStudioInitialize', this.deviceFolder);
      } catch (error) {
        ExceptionHelper.logError('Create arduino sketch file failed.', true);
      }
    });

    return true;
  }

  async compile(): Promise<boolean> {
    return new Promise(
        async (
            resolve: (value: boolean) => void,
            reject: (value: boolean) => void) => {
          try {
            vscode.commands.executeCommand(
                'arduino.iotStudioInitialize', this.deviceFolder);
            await vscode.commands.executeCommand('arduino.verify');
            resolve(true);
          } catch (error) {
            ExceptionHelper.logError(error, true);
            reject(false);
          }
        });
  }

  async upload(): Promise<boolean> {
    return new Promise(
        async (
            resolve: (value: boolean) => void,
            reject: (value: boolean) => void) => {
          try {
            vscode.commands.executeCommand(
                'arduino.iotStudioInitialize', this.deviceFolder);
            await vscode.commands.executeCommand('arduino.upload');
            resolve(true);
          } catch (error) {
            ExceptionHelper.logError(error, true);
            reject(false);
          }
        });
  }

  async setDeviceConnectionString(): Promise<boolean> {
    return new Promise(
        async (
            resolve: (value: boolean) => void,
            reject: (value: boolean) => void) => {
          try {
            // Get IoT Hub device connection string from config
            let deviceConnectionString =
                ConfigHandler.get(ConfigKey.iotHubDeviceConnectionString);

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
                description: `Device Information:  ${hostName}  ${deviceId}`,
                detail: 'select'
              },
              {
                label: 'Input IoT Hub Device Connection String',
                description: 'input another...',
                detail: 'input'
              }
            ];

            const selection = await vscode.window.showQuickPick(
                deviceConnectionStringSelection, {
                  ignoreFocusOut: true,
                  placeHolder: 'Choose IoT Hub Device Connection String'
                });

            if (!selection) {
              reject(false);
              return;
            }

            if (selection.detail === 'input') {
              const option: vscode.InputBoxOptions = {
                value:
                    'HostName=<Host Name>;SharedAccessKeyName=<Key Name>;SharedAccessKey=<SAS Key>',
                prompt: `Please input device connection string here.`,
                ignoreFocusOut: true
              };

              deviceConnectionString = await vscode.window.showInputBox(option);
              if ((deviceConnectionString.indexOf('HostName') === -1) ||
                  (deviceConnectionString.indexOf('DeviceId') === -1) ||
                  (deviceConnectionString.indexOf('SharedAccessKey') === -1)) {
                ExceptionHelper.logError(
                    'The format of the IoT Hub Device connection string is invalid.',
                    true);
              }
            }

            console.log(deviceConnectionString);

            // Set selected connection string to device
            const res =
                await this.flushDeviceConnectionString(deviceConnectionString);
            if (res === false) {
              reject(false);
            } else {
              resolve(true);
            }
          } catch (error) {
            ExceptionHelper.logError(error, true);
            reject(false);
          }
        });
  }

  async flushDeviceConnectionString(connectionString: string):
      Promise<boolean> {
    return new Promise(
        async (
            resolve: (value: boolean) => void,
            reject: (value: boolean) => void) => {
          // Chooes COM port that AZ3166 is connected
          const comPort = await chooseCOM();
          console.log(`Opening ${comPort}.`);

          let configMode = false;
          let errorRejected = false;
          let commandExecuted = false;
          let gotData = false;
          const port = new SerialPort(comPort, {
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
              reject(false);
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
              await sendDataViaSerialPort(port, data.slice(0, 120));
              if (data.length > 120) {
                await delay(1000);
                await sendDataViaSerialPort(port, data.slice(120));
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
          port.on('open', error => {
            if (rejectIfError(error)) return;

            port.write('\r\nhelp\r\n', (error) => {
              if (rejectIfError(error)) return;
            });
          });

          port.on('data', (data) => {
            gotData = true;
            const output = data.toString().trim();

            if (commandExecuted) return;
            if (output.includes('set_')) {
              commandExecuted = true;
              configMode = true;
              executeSetAzIoTHub()
                  .then(() => resolve(true))
                  .catch(() => reject(false));
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

          port.on('error', error => {
            if (errorRejected) return;
            console.log(error);
            rejectIfError(error);
          });

          setTimeout(() => {
            if (errorRejected) return;
            if (!gotData || !configMode) {
              console.log(
                  'Please hold down button A and then push and release the reset button to enter configuration mode.');
              port.write('\r\nhelp\r\n', (error) => {
                rejectIfError(error);
              });
            }
          }, 10000);
        });
  }
}
