// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {resolve} from 'bluebird';
import * as cp from 'child_process';
import * as fs from 'fs-plus';
import * as os from 'os';
import * as path from 'path';
import * as scpClient from 'scp2';
import * as ssh2 from 'ssh2';
import * as vscode from 'vscode';

import {TerminalManager} from '../TerminalManager';
import * as utils from '../utils';

export enum SSH_UPLOAD_METHOD {
  SFTP,
  SCP
}

export class SSH {
  private _client: ssh2.Client;
  private _connected = false;
  private _channel: vscode.OutputChannel;
  private _host: string|undefined;
  private _port: number|undefined;
  private _username: string|undefined;
  private _password: string|undefined;

  constructor(channel: vscode.OutputChannel) {
    this._client = new ssh2.Client();
    this._channel = channel;
  }

  async connect(
      host: string, port: number, username: string, password: string) {
    return new Promise(
        (resolve: (value: boolean) => void,
         reject: (reason: boolean) => void) => {
          const conn = this._client;
          conn.on('ready',
                  () => {
                    this._connected = true;
                    this._host = host;
                    this._password = password;
                    this._port = port;
                    this._username = username;
                    return resolve(true);
                  })
              .on('end',
                  () => {
                    this._connected = false;
                    return resolve(false);
                  })
              .on('close',
                  () => {
                    this._connected = false;
                    return resolve(false);
                  })
              .connect({host, port, username, password});
        });
  }

  async upload(
      filePath: string, remoteRootPath: string,
      method = SSH_UPLOAD_METHOD.SFTP) {
    return new Promise(
        async (
            resolve: (value: boolean) => void,
            reject: (reason: boolean) => void) => {
          if (!this._connected) {
            return resolve(false);
          }

          if (!fs.existsSync(filePath)) {
            return resolve(false);
          }

          filePath = filePath.replace(/[\\\/]+/g, '/');

          const rootPath =
              (fs.isDirectorySync(filePath) ? filePath : path.dirname(filePath))
                  .replace(/\/$/, '');
          const files = fs.isDirectorySync(filePath) ?
              fs.listTreeSync(filePath) :
              [filePath];

          if (this._channel) {
            this._channel.show();
            this._channel.appendLine('');
          }

          if (method === SSH_UPLOAD_METHOD.SFTP) {
            return await this.uploadViaSFTP(
                filePath, remoteRootPath, rootPath, files);
          } else {
            return await this.uploadViaSCP(remoteRootPath, files);
          }
        });
  }

  private async uploadViaSCP(remoteRootPath: string, files: string[]) {
    return new Promise(async (resolve, reject) => {
      try {
        for (const file of files) {
          await this.uploadSingleFileViaSCP(file, remoteRootPath);
        }
        return resolve(true);
      } catch (err) {
        return reject(err);
      }
    });
  }

  private async uploadSingleFileViaSCP(
      filePath: string, remoteRootPath: string) {
    return new Promise(async (resolve, reject) => {
      try {
        if (os.platform() === 'win32') {
          const command = `scp.exe ${filePath}  ${this._username}@${
              this._host}:~/${remoteRootPath}/`;
          TerminalManager.runInTerminal(command);
          // await utils.runCommand(command, 'C:\\Windows\\System32\\OpenSSH\\',
          // this._channel);
          resolve(true);
        } else {
          throw new Error('The platform is not supported.');
        }
      } catch (err) {
        return reject(err);
      }
    });
  }

  private async uploadViaSFTP(
      filePath: string, remoteRootPath: string, rootPath: string,
      files: string[]) {
    return new Promise((resolve, reject) => {
      const conn = this._client;
      conn.sftp(async (err, sftp) => {
        if (err) {
          if (this._channel) {
            this._channel.appendLine(`SFTP Error:`);
            this._channel.appendLine(err.message);
          }
          return resolve(false);
        }

        const rootPathExist = await this.isExist(sftp, remoteRootPath);

        if (rootPathExist) {
          const overwriteOption = await vscode.window.showInformationMessage(
              `${remoteRootPath} exists, overwrite?`, 'Yes', 'No', 'Cancel');
          if (overwriteOption === 'Cancel') {
            if (this._channel) {
              this._channel.appendLine('Device upload cancelled.');
            }
            vscode.window.showWarningMessage('Device upload cancelled.');
            return resolve(true);
          }

          if (overwriteOption === 'No') {
            const raspiPathOption: vscode.InputBoxOptions = {
              value: 'IoTProject',
              prompt: `Please input Raspberry Pi path here.`,
              ignoreFocusOut: true
            };
            let raspiPath = await vscode.window.showInputBox(raspiPathOption);
            if (raspiPath === undefined) {
              return false;
            }
            raspiPath = raspiPath || 'IoTProject';
            const res = await this.upload(filePath, raspiPath);
            return resolve(res);
          }

          const rmDirRes = await this.shell(`rm -rf ${remoteRootPath}`);
          if (!rmDirRes) {
            if (this._channel) {
              this._channel.appendLine(
                  `Directory Error: remove ${remoteRootPath} failed.`);
            }
            return resolve(false);
          }
        }

        const rootPathCreated = await this.ensureDir(sftp, remoteRootPath);

        if (!rootPathCreated) {
          if (this._channel) {
            this._channel.appendLine(`Directory Error: ${remoteRootPath}`);
            this._channel.appendLine(err);
          }
          return resolve(false);
        }

        for (const file of files) {
          const res =
              await this.uploadSingleFile(sftp, file, rootPath, remoteRootPath);
          if (!res) {
            return resolve(false);
          }
        }

        return resolve(true);
      });
    });
  }

  private async isExist(sftp: ssh2.SFTPWrapper, remotePath: string) {
    return new Promise(
        (resolve: (value: boolean) => void,
         reject: (reason: boolean) => void) => {
          sftp.readdir(remotePath, (err, list) => {
            if (err) {
              return resolve(false);
            }
            return resolve(true);
          });
        });
  }

  private async ensureDir(sftp: ssh2.SFTPWrapper, remotePath: string) {
    return new Promise(
        async (
            resolve: (value: boolean) => void,
            reject: (reason: boolean) => void) => {
          const dirExist = await this.isExist(sftp, remotePath);
          if (!dirExist) {
            sftp.mkdir(remotePath, async err => {
              if (err) {
                return resolve(false);
              }

              return resolve(true);
            });
          }
          return resolve(true);
        });
  }

  private async uploadSingleFile(
      sftp: ssh2.SFTPWrapper, filePath: string, rootPath: string,
      remoteRootPath: string) {
    return new Promise(
        async (
            resolve: (value: boolean) => void,
            reject: (reason: boolean) => void) => {
          const relativePath =
              filePath.replace(/[\\\/]+/g, '/').substr(rootPath.length + 1);
          if (/(^|\/)node_modules(\/|$)/.test(relativePath) ||
              /(^|\/).vscode(\/|$)/.test(relativePath) ||
              relativePath === '.iotworkbenchproject') {
            return resolve(true);
          }

          const remotePath =
              path.join(remoteRootPath, relativePath).replace(/[\\\/]+/g, '/');

          if (fs.isDirectorySync(filePath)) {
            const pathCreated = await this.ensureDir(sftp, remotePath);
            if (!pathCreated) {
              if (this._channel) {
                this._channel.appendLine(`Directory Error: ${relativePath}`);
              }
              return resolve(false);
            }
            return resolve(true);
          } else {
            sftp.fastPut(filePath, remotePath, err => {
              if (err) {
                if (this._channel) {
                  this._channel.appendLine(`File Error: ${relativePath}`);
                }

                return resolve(false);
              }

              if (this._channel) {
                this._channel.appendLine(`File Uploaded: ${relativePath}`);
              }
              return resolve(true);
            });
          }
        });
  }

  async shell(command: string, timeout?: number) {
    return new Promise(
        (resolve: (value: boolean) => void,
         reject: (reason: boolean) => void) => {
          if (!this._connected) {
            return resolve(false);
          }

          let timeoutCounter: NodeJS.Timer;

          if (timeout) {
            timeoutCounter = setTimeout(() => {
              return resolve(false);
            }, timeout);
          }

          const conn = this._client;
          conn.shell((err, stream) => {
            if (err) {
              if (this._channel) {
                this._channel.appendLine(`Shell Error:`);
                this._channel.appendLine(err.message);
              }
              return resolve(false);
            }

            if (this._channel) {
              this._channel.show();
              this._channel.appendLine('');
            }

            stream
                .on('close',
                    () => {
                      clearTimeout(timeoutCounter);
                      if (this._channel) {
                        this._channel.appendLine('');
                      }
                      return resolve(true);
                    })
                .on('data',
                    (data: string|Buffer) => {
                      if (this._channel) {
                        const output = data.toString().replace(
                            /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
                            '');
                        this._channel.append(output);
                      }
                    })
                .stderr.on('data', (data: string|Buffer) => {
                  if (this._channel) {
                    const output = data.toString().replace(
                        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
                        '');
                    this._channel.append(output);
                  }
                });

            stream.setWindow(10, 500, 10, 100);
            stream.end(command + '\nexit\n');
          });
        });
  }

  async close() {
    this._client.end();
    return Promise.resolve(true);
  }
}