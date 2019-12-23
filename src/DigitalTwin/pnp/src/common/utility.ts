// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { createHash } from "crypto";
import * as fs from "fs-extra";
import * as path from "path";
import { DeviceModelManager, ModelType } from "../deviceModel/deviceModelManager";
import { DigitalTwinConstants } from "../intelliSense/digitalTwinConstants";
import { ModelFileInfo } from "../modelRepository/modelRepositoryManager";
import { Constants } from "./constants";

/**
 * Common utility
 */
export class Utility {
  /**
   * create file from template with replacement
   * @param templatePath template file path
   * @param filePath target file path
   * @param replacement replacement
   */
  static async createFileFromTemplate(
    templatePath: string,
    filePath: string,
    replacement: Map<string, string>,
  ): Promise<void> {
    const template: string = await fs.readFile(templatePath, Constants.UTF8);
    const content: string = Utility.replaceAll(template, replacement);
    const jsonContent = JSON.parse(content);
    await fs.writeJson(filePath, jsonContent, { spaces: Constants.JSON_SPACE, encoding: Constants.UTF8 });
  }

  /**
   * replace all for content
   * @param str string
   * @param replacement replacement
   * @param caseInsensitive identify if it is case insensitive
   */
  static replaceAll(str: string, replacement: Map<string, string>, caseInsensitive = false): string {
    const flag = caseInsensitive ? "ig" : "g";
    const keys = Array.from(replacement.keys());
    const pattern = new RegExp(keys.join("|"), flag);
    return str.replace(pattern, (matched) => {
      const value: string | undefined = replacement.get(matched);
      return value || matched;
    });
  }

  /**
   * validate DigitalTwin model name, return error message if validation fail
   * @param name model name
   * @param type model type
   * @param folder target folder
   */
  static async validateModelName(name: string, type: ModelType, folder: string): Promise<string | undefined> {
    if (!name || name.trim() === Constants.EMPTY_STRING) {
      return `Name ${Constants.NOT_EMPTY_MSG}`;
    }
    if (!Constants.MODEL_NAME_REGEX.test(name)) {
      return `Name can only contain ${Constants.MODEL_NAME_REGEX_DESCRIPTION}`;
    }
    const filename: string = DeviceModelManager.generateModelFileName(name, type);
    if (await fs.pathExists(path.join(folder, filename))) {
      return `${type} ${name} already exists in folder ${folder}`;
    }
    return undefined;
  }

  /**
   * validate name is not empty, return error message if validation fail
   * @param name name
   * @param placeholder placeholder for message
   */
  static validateNotEmpty(name: string, placeholder: string): string | undefined {
    if (!name || name.trim() === Constants.EMPTY_STRING) {
      return `${placeholder} ${Constants.NOT_EMPTY_MSG}`;
    }
    return undefined;
  }

  /**
   * enforce url with https protocol
   * @param url url
   */
  static enforceHttps(url: string): string {
    return Constants.URL_PROTOCAL_REGEX.test(url)
      ? url.replace(Constants.URL_PROTOCAL_REGEX, Constants.HTTPS_PROTOCAL)
      : Constants.HTTPS_PROTOCAL + url;
  }

  /**
   * create DigitalTwin model file
   * @param folder target folder
   * @param modelId model id
   * @param content model content
   */
  // tslint:disable-next-line:no-any
  static async createModelFile(folder: string, modelId: string, content: any): Promise<void> {
    const type: ModelType = DeviceModelManager.convertToModelType(content[DigitalTwinConstants.TYPE]);
    if (!type) {
      throw new Error(Constants.MODEL_TYPE_INVALID_MSG);
    }
    const replacement = new Map<string, string>();
    replacement.set(":", "_");
    const modelName: string = Utility.replaceAll(modelId, replacement);
    let candidate: string = DeviceModelManager.generateModelFileName(modelName, type);
    let counter = 0;
    while (true) {
      if (!(await fs.pathExists(path.join(folder, candidate)))) {
        break;
      }
      counter++;
      candidate = DeviceModelManager.generateModelFileName(`${modelName}_${counter}`, type);
    }
    await fs.writeJson(path.join(folder, candidate), content, {
      spaces: Constants.JSON_SPACE,
      encoding: Constants.UTF8,
    });
  }

  /**
   * get model file info
   * @param filePath file path
   */
  static async getModelFileInfo(filePath: string): Promise<ModelFileInfo | undefined> {
    const content = await Utility.getJsonContent(filePath);
    const modelId: string = content[DigitalTwinConstants.ID];
    const context: string = content[DigitalTwinConstants.CONTEXT];
    const modelType: ModelType = DeviceModelManager.convertToModelType(content[DigitalTwinConstants.TYPE]);
    if (modelId && context && modelType) {
      return {
        id: modelId,
        type: modelType,
        filePath,
      };
    }
    return undefined;
  }

  /**
   * get json content from file
   * @param filePath file path
   */
  // tslint:disable-next-line:no-any
  static async getJsonContent(filePath: string): Promise<any> {
    return fs.readJson(filePath, { encoding: Constants.UTF8 });
  }

  /**
   * get hash value of payload
   * @param payload payload
   */
  static hash(payload: string): string {
    return createHash(Constants.SHA256)
      .update(payload)
      .digest(Constants.HEX);
  }

  private constructor() {}
}
