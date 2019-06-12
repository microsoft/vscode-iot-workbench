'use strict';

import * as fs from 'fs-plus';
import * as path from 'path';
import * as sdk from 'vscode-iot-device-cube-sdk';
import {ScaffoldType} from './constants';

export class FileUtility {
  static async directoryExists(type: ScaffoldType, dirPath: string): Promise<boolean> {
    if (type === ScaffoldType.Local) {
      if (!await sdk.FileSystem.exists(dirPath)) {
        return false;
      }
      const isDirectory = await sdk.FileSystem.isDirectory(dirPath);
      return isDirectory;
    } else {
      return new Promise((resolve: (exist: boolean) => void) => {
        fs.stat(dirPath, (error: Error | null, stats) => {
          if (error) {
            resolve(false);
            return;
          }
          resolve(stats.isDirectory());
          return;
        });
      });
    }
  }

  static async fileExists(type: ScaffoldType, filePath: string): Promise<boolean> {
    if (type === ScaffoldType.Local) {
      const directoryExists = await sdk.FileSystem.exists(filePath);
      if (!directoryExists) {
        return false;
      }
      const isFile = await sdk.FileSystem.isFile(filePath);
      return isFile;
    } else {
      return new Promise((resolve: (exist: boolean) => void) => {
        fs.stat(filePath, (error: Error | null, stats) => {
          if (error) {
            resolve(false);
            return;
          }
          resolve(stats.isFile());
          return;
        });
      });
    }
  }

  static async mkdir(type: ScaffoldType, dirPath: string): Promise<void> {
    if (type === ScaffoldType.Local) {
      return await sdk.FileSystem.mkDir(dirPath);
    } else {
      return new Promise(async (resolve: (value?: void) => void, reject) => {
        fs.mkdir(dirPath, { recursive: true }, (error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
          return;
        });
      });
      }
  }

  static async mkdirRecursively(type: ScaffoldType, dirPath: string): Promise<void> {
    if (await FileUtility.directoryExists(type, dirPath)) {
      return;
    }
    const dirname = path.dirname(dirPath);
    if (path.normalize(dirname) === path.normalize(dirPath)) {
      await FileUtility.mkdirRecursively(type, dirname);
    } else if (await FileUtility.directoryExists(type, dirname)) {
      await FileUtility.mkdir(type, dirPath);
    } else {
      await FileUtility.mkdirRecursively(type, dirname);
      await FileUtility.mkdir(type, dirPath);
    }
  }

  static async writeFile(type: ScaffoldType, filePath: string, data: string | Buffer): Promise<void> {
    if (type === ScaffoldType.Local) {
      return await sdk.FileSystem.writeFile(filePath, data);
    } else {
      return new Promise(async (resolve: (value?: void) => void, reject) => {
        await fs.writeFile(filePath, data, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
          return;
        });
      });
    }
  }

  static async readFile(type: ScaffoldType, filePath: string, encoding?: string): Promise<string | Buffer> {
    if (type === ScaffoldType.Local) {
      return await sdk.FileSystem.readFile(filePath, encoding);
    } else {
      return new Promise(async (resolve: (data: string | Buffer) => void, reject) => {
        await fs.readFile(filePath, encoding, (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(data);
          return;
        });
      });
    }
  }
}