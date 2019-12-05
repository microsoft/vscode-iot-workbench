// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';
import * as utils from '../utils';
import {getExtension} from '../Models/Apis';
import {ExtensionName} from '../Models/Interfaces/Api';
import {DigitalTwinConstants} from './DigitalTwinConstants';
import {CancelOperationError} from '../CancelOperationError';

/**
 * Digital Twin extension utility
 */
export class DigitalTwinUtility {
  private static readonly EXTENSION_NOT_INIT =
      'Azure Digital Twin extension is not inititalized';
  // tslint:disable-next-line: no-any
  private static extensionInstance: any;
  private static channel: vscode.OutputChannel;

  /**
   * initialize utility for Digital Twin extension
   * @param channel output channel
   */
  static init(channel: vscode.OutputChannel): boolean {
    const digitalTwins = getExtension(ExtensionName.DigitalTwins);
    if (!digitalTwins) {
      utils.channelShowAndAppendLine(
          channel,
          'Azure Digital Twins extension is required, please install it from marketplace.');
      return false;
    }
    DigitalTwinUtility.extensionInstance = digitalTwins.apiProvider;
    DigitalTwinUtility.channel = channel;
    return true;
  }

  /**
   * select capability model
   */
  static async selectCapabilityModel(): Promise<string> {
    if (!DigitalTwinUtility.extensionInstance) {
      throw new Error(DigitalTwinUtility.EXTENSION_NOT_INIT);
    }
    let result = '';
    try {
      result =
          await DigitalTwinUtility.extensionInstance.selectCapabilityModel();
    } catch {
      // skip for UserCancelledError
    }
    if (!result) {
      throw new CancelOperationError(
          `Selected device capability model file cancelled.`);
    }

    utils.channelShowAndAppendLine(
        DigitalTwinUtility.channel,
        `${
            DigitalTwinConstants
                .dtPrefix} Selected device capability model file: ${result}`);
    return result;
  }

  /**
   * download dependent interface,
   * return true if all interface is successfully downloaded, otherwise false
   * @param folder folder to download interface
   * @param capabilityModelFile capability model file path
   */
  static async downloadDependentInterface(
      folder: string, capabilityModelFile: string): Promise<boolean> {
    if (!DigitalTwinUtility.extensionInstance) {
      throw new Error(DigitalTwinUtility.EXTENSION_NOT_INIT);
    }
    try {
      await DigitalTwinUtility.extensionInstance.downloadDependentInterface(
          folder, capabilityModelFile);
    } catch (error) {
      utils.channelShowAndAppendLine(
          DigitalTwinUtility.channel,
          `${DigitalTwinConstants.dtPrefix} ${error.message}`);
      return false;
    }
    return true;
  }
}