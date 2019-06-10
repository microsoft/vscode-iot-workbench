'use strict';

import * as fs from 'fs-plus';
import * as path from 'path';
import * as sdk from 'vscode-iot-device-cube-sdk';
import {ScaffoldType} from './constants';

export class FileUtility {

  static async exists(type: ScaffoldType, path: string): Promise<boolean> {
    if (type === ScaffoldType.local) {
      return await sdk.FileSystem.exists(path);
    } else {
      return new Promise((resolve: (exist: boolean) => void) => {
        fs.stat(path, (error: Error | null) => {
          if (error) {
            resolve(false);
            return;
          }
          resolve(true);
          return;
        });
      });
    }
  }

  static async writeFile(type: ScaffoldType, filePath: string, data: string | Buffer): Promise<void> {
    if (type === ScaffoldType.local) {
      return await sdk.FileSystem.writeFile(filePath, data);
    } else {
      return new Promise(async (resolve: (value?: void) => void, reject) => {
        await fs.writeFile(filePath, data, (err) => {
          if (err) {
            reject(err);
          }
          return;
        });
        resolve();
      });
    }
    
  }

  static async directoryExists(type: ScaffoldType, dirPath: string): Promise<boolean> {
    if (type === ScaffoldType.local) {
      if (!await sdk.FileSystem.exists(dirPath)) {
        return false;
      }
      const isDirectory = await sdk.FileSystem.isDirectory(dirPath);
      return isDirectory;
    } else {
      try {
        return fs.statSync(dirPath).isDirectory();
      } catch (e) {
        return false;
      }
    }
  }

  static async mkdir(type: ScaffoldType, dirPath: string): Promise<void> {
    if (type === ScaffoldType.local) {
      await sdk.FileSystem.mkDir(dirPath);
    } else {
      fs.mkdirSync(dirPath);
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

  static async fileExists(type: ScaffoldType, filePath: string): Promise<boolean> {
    if (type === ScaffoldType.local) {
      const directoryExists = await sdk.FileSystem.exists(filePath);
      if (!directoryExists) {5
        return false;
      }
      const isFile = await sdk.FileSystem.isFile(filePath);
      return isFile;
    } else {
      try {
        return fs.statSync(filePath).isFile();
      } catch (e) {
        return false;
      }
    }
  }

  static async readFile(type: ScaffoldType, filePath: string, encoding: string): Promise<string> {
    if (type === ScaffoldType.local) {
      return await sdk.FileSystem.readFile(filePath, encoding) as string;
    } else {
      return fs.readFileSync(filePath, encoding);
    }
  }
}