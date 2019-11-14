// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';
import * as utils from '../utils';
import { getExtension } from '../Models/Apis';
import { ExtensionName } from '../Models/Interfaces/Api';
import { DigitalTwinConstants } from './DigitalTwinConstants';

/**
 * Digital Twin extension utility
 */
export class DigitalTwinUtility {
  // tslint:disable-next-line: no-any
  private static instance: any;
  private static channel: vscode.OutputChannel;

  /**
   * check if digital twin extension is available,
   * and init if available
   * @param channel output channel
   */
  public static isAvailable(channel: vscode.OutputChannel): boolean {
    const digitalTwins = getExtension(ExtensionName.DigitalTwins);
    if (!digitalTwins) {
      utils.channelShowAndAppendLine(
        channel, 'Azure Digital Twins is not installed. Please install it from Marketplace.');
      return false;
    }
    DigitalTwinUtility.instance = digitalTwins.apiProvider;
    DigitalTwinUtility.channel = channel;
    return true;
  }

  /**
   * select capability model
   */
  public static async selectCapabilityModel(): Promise<string> {
    let result: string = '';
    try {
      result = await DigitalTwinUtility.instance.selectCapabilityModel();
    } catch {
      // skip for UserCancelledError
    }
    if (!result) {
      utils.channelShowAndAppendLine(
        DigitalTwinUtility.channel, `${DigitalTwinConstants.dtPrefix} Cancelled.`);
    }
    return result;
  }

  /**
   * download dependent interface,
   * return true if all interface is successfully downloaded, otherwise return false
   * @param folder folder to download interface
   * @param capabilityModelFile capability model file path
   */
  public static async downloadDependentInterface(folder: string, capabilityModelFile: string): Promise<boolean> {
    try {
      await DigitalTwinUtility.instance.downloadDependentInterface(folder, capabilityModelFile);
    } catch (error) {
      utils.channelShowAndAppendLine(
        DigitalTwinUtility.channel, `${DigitalTwinConstants.dtPrefix} ${error.message}`);
      return false;
    }
    return true;
  }
}