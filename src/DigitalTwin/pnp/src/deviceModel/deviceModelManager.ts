// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from "path";
import * as vscode from "vscode";
import { ColorizedChannel } from "../common/colorizedChannel";
import { Constants } from "../common/constants";
import { ProcessError } from "../common/processError";
import { Utility } from "../common/utility";
import { MessageType, UI } from "../view/ui";
import { UIConstants } from "../view/uiConstants";

/**
 * DigitalTwin model type
 */
export enum ModelType {
  Interface = "Interface",
  CapabilityModel = "Capability Model",
}

/**
 * DigitalTwin device model manager
 */
export class DeviceModelManager {
  /**
   * convert to DigitalTwin model type
   * @param name name
   */
  static convertToModelType(name: string): ModelType {
    return ModelType[name as keyof typeof ModelType];
  }

  /**
   * generate DigitalTwin model id
   * @param name model name
   */
  static generateModelId(name: string): string {
    return `urn:{companyName}:${name}:1`;
  }

  /**
   * generate DigitalTwin model file name
   * @param name model name
   * @param type model type
   */
  static generateModelFileName(name: string, type: ModelType): string {
    const fileType: string = type.replace(/\s+/g, Constants.EMPTY_STRING).toLowerCase();
    return `${name}.${fileType}.json`;
  }

  /**
   * get DigitalTwin template file name
   * @param type model type
   */
  static getTemplateFileName(type: ModelType): string {
    return DeviceModelManager.generateModelFileName(Constants.SAMPLE_FILE_NAME, type);
  }

  private readonly component: string;
  constructor(private readonly context: vscode.ExtensionContext, private readonly outputChannel: ColorizedChannel) {
    this.component = Constants.DEVICE_MODEL_COMPONENT;
  }

  /**
   * create DigitalTwin model with UI interaction
   * @param type model type
   */
  async createModel(type: ModelType): Promise<void> {
    const folder: string = await UI.selectRootFolder(UIConstants.SELECT_ROOT_FOLDER_LABEL);
    const name: string = await UI.inputModelName(UIConstants.INPUT_MODEL_NAME_LABEL, type, folder);
    const operation = `Create ${type} ${name} in folder ${folder}`;
    this.outputChannel.start(operation, this.component);

    let filePath: string;
    try {
      filePath = await this.doCreateModel(type, folder, name);
    } catch (error) {
      throw new ProcessError(operation, error, this.component);
    }

    await UI.openAndShowTextDocument(filePath);
    UI.showNotification(MessageType.Info, ColorizedChannel.formatMessage(operation));
    this.outputChannel.end(operation, this.component);
  }

  /**
   * create DigitalTwin model
   * @param type model type
   * @param folder root folder
   * @param name model name
   */
  private async doCreateModel(type: ModelType, folder: string, name: string): Promise<string> {
    const modelId: string = DeviceModelManager.generateModelId(name);
    const filePath: string = path.join(folder, DeviceModelManager.generateModelFileName(name, type));
    const templatePath: string = this.context.asAbsolutePath(
      path.join(Constants.RESOURCE_FOLDER, Constants.TEMPLATE_FOLDER, DeviceModelManager.getTemplateFileName(type)),
    );
    const replacement = new Map<string, string>();
    replacement.set(Constants.DIGITAL_TWIN_ID_PLACEHOLDER, modelId);
    await Utility.createFileFromTemplate(templatePath, filePath, replacement);
    return filePath;
  }
}
