'use strict';

import * as fs from 'fs-plus';
import * as path from 'path';
import * as sdk from 'vscode-iot-device-cube-sdk';

export class FileUtility {

  // File-related functions to help create files on workspace path
  static async existsInWorkspace(localPath: string): Promise<boolean> {
    return new Promise((resolve: (exist: boolean) => void) => {
      fs.stat(localPath, (error: Error | null) => {
        if (error) {
          resolve(false);
          return;
        }
        resolve(true);
        return;
      });
    });
  }

  static async writeFileInWorkspace(filePath: string, data: string | Buffer): Promise<void> {
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

  static async directoryExistsInWorkspace(dirPath: string): Promise<boolean> {
    try {
      return fs.statSync(dirPath).isDirectory();
    } catch (e) {
      return false;
    }
  }

  static async mkdirRecursivelyInWorkspace(dirPath: string): Promise<void> {
    if (await FileUtility.directoryExistsInWorkspace(dirPath)) {
      return;
    }
    const dirname = path.dirname(dirPath);
    if (path.normalize(dirname) === path.normalize(dirPath)) {
      fs.mkdirSync(dirPath);
    } else if (await FileUtility.directoryExistsInWorkspace(dirname)) {
      fs.mkdirSync(dirPath);
    } else {
      await FileUtility.mkdirRecursivelyInWorkspace(dirname);
      fs.mkdirSync(dirPath);
    }
  }

  static async fileExistsInWorkspace(filePath: string): Promise<boolean> {
    try {
      return fs.statSync(filePath).isFile();
    } catch (e) {
      return false;
    }
  }

  static async readFileInWorkspace(filePath: string, encoding: string): Promise<string> {
    return fs.readFileSync(filePath, encoding);
  }

  // File-related functions to help create files on a local path
  static async existsInLocal(localPath: string): Promise<boolean> {
    return await sdk.FileSystem.exists(localPath);
  }

  static async writeFileInLocal(filePath: string, data: string | Buffer): Promise<void> {
    return await sdk.FileSystem.writeFile(filePath, data);
  }

  static async directoryExistsInLocal(dirPath: string): Promise<boolean> {
    if (!await sdk.FileSystem.exists(dirPath)) {
      return false;
    }
    const isDirectory = await sdk.FileSystem.isDirectory(dirPath);
    return isDirectory;
  }

  static async mkdirRecursivelyInLocal(dirPath: string): Promise<void> {
    if (await FileUtility.directoryExistsInLocal(dirPath)) {
      return;
    }
    const dirname = path.dirname(dirPath);
    if (path.normalize(dirname) === path.normalize(dirPath)) {
      await sdk.FileSystem.mkDir(dirPath);
    } else if (await FileUtility.directoryExistsInLocal(dirname)) {
      await sdk.FileSystem.mkDir(dirPath);
    } else {
      await FileUtility.mkdirRecursivelyInLocal(dirname);
      await sdk.FileSystem.mkDir(dirPath);
    }
  }

  static async fileExistsInLocal(filePath: string): Promise<boolean> {
    const directoryExists = await sdk.FileSystem.exists(filePath);
    if (!directoryExists) {
      return false;
    }
    const isFile = await sdk.FileSystem.isFile(filePath);
    return isFile;
  }

  static async readFileInLocal(filePath: string, encoding: string): Promise<string> {
    return await sdk.FileSystem.readFile(filePath, encoding) as string;
  }
}