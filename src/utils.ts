import * as fs from 'fs-plus';
import * as path from 'path';
import {setTimeout} from 'timers';
import * as vscode from 'vscode';
import * as WinReg from 'winreg';
import { ConfigHandler } from './configHandler';
import { ConfigKey } from './constants';

export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getRegistryValues(
    hive: string, key: string, name: string): Promise<string> {
  return new Promise(
      async (
          resolve: (value: string) => void, reject: (value: Error) => void) => {
        try {
          const regKey = new WinReg({
            hive,
            key,
          });

          regKey.valueExists(name, (e, exists) => {
            if (e) {
              return reject(e);
            }
            if (exists) {
              regKey.get(name, (err, result) => {
                if (!err) {
                  return resolve(result ? result.value : '');
                } else {
                  return reject(err);
                }
              });
            } else {
              return resolve('');
            }
          });
        } catch (ex) {
          return reject(ex);
        }
      });
}

export function directoryExistsSync(dirPath: string): boolean {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch (e) {
    return false;
  }
}

export function mkdirRecursivelySync(dirPath: string): void {
  if (directoryExistsSync(dirPath)) {
    return;
  }
  const dirname = path.dirname(dirPath);
  if (path.normalize(dirname) === path.normalize(dirPath)) {
    fs.mkdirSync(dirPath);
  } else if (directoryExistsSync(dirname)) {
    fs.mkdirSync(dirPath);
  } else {
    mkdirRecursivelySync(dirname);
    fs.mkdirSync(dirPath);
  }
}

export function fileExistsSync(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch (e) {
    return false;
  }
}

export function checkIoTDevProject(): boolean {
  const devicePath = ConfigHandler.get<string>(ConfigKey.devicePath);
  if (!devicePath) {
    throw new Error("Cannot run IoT Dev command in a non-IoTDev project. Please initialize an IoT Dev project first.")
  }

  return true
}
