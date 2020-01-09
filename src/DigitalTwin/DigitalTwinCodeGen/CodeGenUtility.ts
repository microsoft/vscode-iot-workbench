// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as utils from '../../utils';
import * as vscode from 'vscode';
import { CodeGenExecutionItem } from './Interfaces/CodeGenerator';

export class CodeGenUtility {
  static printCodeGenConfig(codeGenExecutionItem: CodeGenExecutionItem, channel: vscode.OutputChannel): void {
    utils.channelShowAndAppendLine(
      channel,
      `Device capability model file: ${
        codeGenExecutionItem.capabilityModelFilePath}`);
    utils.channelShowAndAppendLine(
      channel, `Project name: ${codeGenExecutionItem.projectName}`);
    utils.channelShowAndAppendLine(
      channel, `Language: ${codeGenExecutionItem.languageLabel}`);
    utils.channelShowAndAppendLine(
      channel,
      `Device connection type: ${codeGenExecutionItem.deviceConnectionType}`);
    utils.channelShowAndAppendLine(
      channel, `Project type: ${codeGenExecutionItem.codeGenProjectType}`);
    utils.channelShowAndAppendLine(
      channel,
      `Device SDK reference type: ${
        codeGenExecutionItem.deviceSdkReferenceType}`);
    utils.channelShowAndAppendLine(
      channel,
      `Project output directory: ${codeGenExecutionItem.outputDirectory}`);
  }
}