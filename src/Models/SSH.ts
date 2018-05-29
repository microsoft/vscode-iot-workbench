// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {reject} from 'bluebird';
import * as fs from 'fs-plus';
import * as path from 'path';
import * as ssh2 from 'ssh2';
import * as vscode from 'vscode';

export class SSH {
  private _client: ssh2.Client;
  private _connected = false;
  private _channel: vscode.OutputChannel|null = null;

  constructor(channel?: vscode.OutputChannel) {
    this._client = new ssh2.Client();
    if (channel) {
      this._channel = channel;
    }
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
                    return resolve(true);
                  })
              .on('end',
                  () => {
                    this._connected = false;
                    return reject(false);
                  })
              .on('close',
                  () => {
                    this._connected = false;
                    return reject(false);
                  })
              .connect({host, port, username, password});
        });
  }

  async upload(filePath: string, remoteRootPath: string) {
    return new Promise(
        (resolve: (value: boolean) => void,
         reject: (reason: boolean) => void) => {
          if (!this._connected) {
            return reject(false);
          }

          if (!fs.existsSync(filePath)) {
            return reject(false);
          }

          filePath = filePath.replace(/[\\\/]+/g, '/');

          const rootPath =
              (fs.isDirectorySync(filePath) ? filePath : path.dirname(filePath))
                  .replace(/\/$/, '');
          const files = fs.listTreeSync(filePath);

          if (this._channel) {
            this._channel.show();
          }

          const conn = this._client;
          conn.sftp(async (err, sftp) => {
            if (err) {
              throw err;
            }

            sftp.mkdir(remoteRootPath, async err => {
              if (err) {
                return reject(false);
              }

              for (const file of files) {
                const res = await this.uploadSingleFile(
                    sftp, file, rootPath, remoteRootPath);
                if (!res) {
                  return reject(false);
                }
              }

              return resolve(true);
            });
          });
        });
  }

  private async uploadSingleFile(
      sftp: ssh2.SFTPWrapper, filePath: string, rootPath: string,
      remoteRootPath: string) {
    return new Promise(
        (resolve: (value: boolean) => void,
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
            sftp.mkdir(remotePath, err => {
              if (err) {
                if (this._channel) {
                  this._channel.appendLine(`Directory Error: ${relativePath}`);
                }

                return reject(false);
              }

              if (this._channel) {
                this._channel.appendLine(`Directory Created: ${relativePath}`);
              }
              return resolve(true);
            });
          } else {
            sftp.fastPut(filePath, remotePath, err => {
              if (err) {
                if (this._channel) {
                  this._channel.appendLine(`File Error: ${relativePath}`);
                }

                return reject(false);
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
            return reject(false);
          }

          let timeoutCounter: NodeJS.Timer;

          if (timeout) {
            timeoutCounter = setTimeout(() => {
              return reject(false);
            }, timeout);
          }

          const conn = this._client;
          conn.shell((err, stream) => {
            if (err) {
              throw err;
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

            stream.end(command + '\n');
          });
        });
  }

  async close() {
    this._client.end();
    return Promise.resolve(true);
  }
}