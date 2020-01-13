// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from "fs-plus";
import * as path from "path";
import * as ssh2 from "ssh2";
import * as vscode from "vscode";
import { channelShowAndAppendLine } from "../utils";

export class SSH {
  private _client: ssh2.Client;
  private _connected = false;
  private _channel: vscode.OutputChannel | null = null;

  constructor(channel?: vscode.OutputChannel) {
    this._client = new ssh2.Client();
    if (channel) {
      this._channel = channel;
    }
  }

  async connect(host: string, port: number, username: string, password: string): Promise<boolean> {
    return new Promise((resolve: (value: boolean) => void) => {
      const conn = this._client;
      conn
        .on("ready", () => {
          this._connected = true;
          return resolve(true);
        })
        .on("end", () => {
          this._connected = false;
          return resolve(false);
        })
        .on("close", () => {
          this._connected = false;
          return resolve(false);
        })
        .connect({ host, port, username, password });
    });
  }

  async upload(filePath: string, remoteRootPath: string): Promise<boolean> {
    return new Promise((resolve: (value: boolean) => void) => {
      if (!this._connected) {
        return resolve(false);
      }

      if (!fs.existsSync(filePath)) {
        return resolve(false);
      }

      filePath = filePath.replace(/[\\/]+/g, "/");

      const rootPath = (fs.isDirectorySync(filePath) ? filePath : path.dirname(filePath)).replace(/\/$/, "");
      const files = fs.listTreeSync(filePath);

      if (this._channel) {
        channelShowAndAppendLine(this._channel, "");
      }

      const conn = this._client;
      conn.sftp(async (err, sftp) => {
        if (err) {
          if (this._channel) {
            channelShowAndAppendLine(this._channel, `SFTP Error:`);
            channelShowAndAppendLine(this._channel, err.message);
          }
          return resolve(false);
        }

        const rootPathExist = await this.isExist(sftp, remoteRootPath);

        if (rootPathExist) {
          const overwriteOption = await vscode.window.showInformationMessage(
            `${remoteRootPath} exists, overwrite?`,
            "Yes",
            "No",
            "Cancel"
          );
          if (overwriteOption === "Cancel") {
            if (this._channel) {
              channelShowAndAppendLine(this._channel, "Device upload cancelled.");
            }
            vscode.window.showWarningMessage("Device upload cancelled.");
            return resolve(true);
          }

          if (overwriteOption === "No") {
            const raspiPathOption: vscode.InputBoxOptions = {
              value: "IoTProject",
              prompt: `Please input Raspberry Pi path here.`,
              ignoreFocusOut: true
            };
            let raspiPath = await vscode.window.showInputBox(raspiPathOption);
            if (!raspiPath) {
              return false;
            }
            raspiPath = raspiPath || "IoTProject";
            const res = await this.upload(filePath, raspiPath);
            return resolve(res);
          }

          const rmDirRes = await this.shell(`rm -rf ${remoteRootPath}`);
          if (!rmDirRes) {
            if (this._channel) {
              channelShowAndAppendLine(this._channel, `Directory Error: remove ${remoteRootPath} failed.`);
            }
            return resolve(false);
          }
        }

        const rootPathCreated = await this.ensureDir(sftp, remoteRootPath);

        if (!rootPathCreated) {
          if (this._channel) {
            channelShowAndAppendLine(this._channel, `Directory Error: ${remoteRootPath}`);
            channelShowAndAppendLine(this._channel, err);
          }
          return resolve(false);
        }

        for (const file of files) {
          const res = await this.uploadSingleFile(sftp, file, rootPath, remoteRootPath);
          if (!res) {
            return resolve(false);
          }
        }

        return resolve(true);
      });
    });
  }

  private async isExist(sftp: ssh2.SFTPWrapper, remotePath: string): Promise<boolean> {
    return new Promise((resolve: (value: boolean) => void) => {
      sftp.readdir(remotePath, err => {
        if (err) {
          return resolve(false);
        }
        return resolve(true);
      });
    });
  }

  private async ensureDir(sftp: ssh2.SFTPWrapper, remotePath: string): Promise<boolean> {
    return new Promise(
      // eslint-disable-next-line no-async-promise-executor
      async (resolve: (value: boolean) => void) => {
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
      }
    );
  }

  private async uploadSingleFile(
    sftp: ssh2.SFTPWrapper,
    filePath: string,
    rootPath: string,
    remoteRootPath: string
  ): Promise<boolean> {
    return new Promise(
      // eslint-disable-next-line no-async-promise-executor
      async (resolve: (value: boolean) => void) => {
        const relativePath = filePath.replace(/[\\/]+/g, "/").substr(rootPath.length + 1);
        if (
          /(^|\/)node_modules(\/|$)/.test(relativePath) ||
          /(^|\/).vscode(\/|$)/.test(relativePath) ||
          relativePath === ".iotworkbenchproject"
        ) {
          return resolve(true);
        }

        const remotePath = path.join(remoteRootPath, relativePath).replace(/[\\/]+/g, "/");

        if (fs.isDirectorySync(filePath)) {
          const pathCreated = await this.ensureDir(sftp, remotePath);
          if (!pathCreated) {
            if (this._channel) {
              channelShowAndAppendLine(this._channel, `Directory Error: ${relativePath}`);
            }
            return resolve(false);
          }
          return resolve(true);
        } else {
          sftp.fastPut(filePath, remotePath, err => {
            if (err) {
              if (this._channel) {
                channelShowAndAppendLine(this._channel, `File Error: ${relativePath}`);
              }

              return resolve(false);
            }

            if (this._channel) {
              channelShowAndAppendLine(this._channel, `File Uploaded: ${relativePath}`);
            }
            return resolve(true);
          });
        }
      }
    );
  }

  async shell(command: string, timeout?: number): Promise<boolean> {
    return new Promise((resolve: (value: boolean) => void) => {
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
            channelShowAndAppendLine(this._channel, `Shell Error:`);
            channelShowAndAppendLine(this._channel, err.message);
          }
          return resolve(false);
        }

        if (this._channel) {
          channelShowAndAppendLine(this._channel, "");
        }

        stream
          .on("close", () => {
            clearTimeout(timeoutCounter);
            if (this._channel) {
              channelShowAndAppendLine(this._channel, "");
            }
            return resolve(true);
          })
          .on("data", (data: string | Buffer) => {
            if (this._channel) {
              const output = data.toString().replace(
                // eslint-disable-next-line no-control-regex
                /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
                ""
              );
              this._channel.append(output);
            }
          })
          .stderr.on("data", (data: string | Buffer) => {
            if (this._channel) {
              const output = data.toString().replace(
                // eslint-disable-next-line no-control-regex
                /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
                ""
              );
              this._channel.append(output);
            }
          });

        stream.setWindow(10, 500, 10, 100);
        stream.end(command + "\nexit\n");
      });
    });
  }

  async close(): Promise<boolean> {
    this._client.end();
    return Promise.resolve(true);
  }
}
