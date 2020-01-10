"use strict";

import * as fs from "fs-plus";
import * as path from "path";
import * as sdk from "vscode-iot-device-cube-sdk";
import * as crypto from "crypto";
import { ScaffoldType } from "./constants";
import extractzip = require("extract-zip");

export class FileUtility {
  static async directoryExists(
    type: ScaffoldType,
    dirPath: string
  ): Promise<boolean> {
    if (type === ScaffoldType.Local) {
      if (!(await sdk.FileSystem.exists(dirPath))) {
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

  static async fileExists(
    type: ScaffoldType,
    filePath: string
  ): Promise<boolean> {
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
      return new Promise((resolve: (value?: void) => void, reject) => {
        fs.mkdir(dirPath, error => {
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

  static async mkdirRecursively(
    type: ScaffoldType,
    dirPath: string
  ): Promise<void> {
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

  // Make sure filepath's parent directory exists
  static async writeFile(
    type: ScaffoldType,
    filePath: string,
    data: string | Buffer
  ): Promise<void> {
    if (type === ScaffoldType.Local) {
      return await sdk.FileSystem.writeFile(filePath, data);
    } else {
      return new Promise((resolve: (value?: void) => void, reject) => {
        fs.writeFile(filePath, data, err => {
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

  /**
   * Convert Json object to Json string and write into target file path.
   * @param type Scaffold type
   * @param fileDestPath tartet file path
   * @param data Json object
   */
  static async writeJsonFile(
    type: ScaffoldType,
    fileDestPath: string,
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    data: any
  ): Promise<void> {
    const indentationSpace = 4;
    const jsonString = JSON.stringify(data, null, indentationSpace);

    const fileDir = path.dirname(fileDestPath);
    if (!(await FileUtility.directoryExists(type, fileDir))) {
      await FileUtility.mkdirRecursively(type, fileDir);
    }
    await FileUtility.writeFile(type, fileDestPath, jsonString);
  }

  static async readFile(
    type: ScaffoldType,
    filePath: string,
    encoding?: string
  ): Promise<string | Buffer> {
    if (type === ScaffoldType.Local) {
      return await sdk.FileSystem.readFile(filePath, encoding);
    } else {
      return new Promise((resolve: (data: string | Buffer) => void, reject) => {
        fs.readFile(filePath, encoding, (err, data) => {
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

  static async extractZipFile(
    sourceZip: string,
    targetFoder: string
  ): Promise<boolean> {
    return new Promise((resolve: (value: boolean) => void, reject) => {
      extractzip(sourceZip, { dir: targetFoder }, err => {
        if (err) {
          return reject(err);
        } else {
          return resolve(true);
        }
      });
    });
  }

  static async getFileHash(
    filename: string,
    algorithm = "md5"
  ): Promise<string> {
    const hash = crypto.createHash(algorithm);
    const input = fs.createReadStream(filename);
    let hashvalue = "";

    return new Promise((resolve: (value: string) => void, reject) => {
      input.on("readable", () => {
        const data = input.read();
        if (data) {
          hash.update(data);
        }
      });
      input.on("error", reject);
      input.on("end", () => {
        hashvalue = hash.digest("hex");
        return resolve(hashvalue);
      });
    });
  }
}
