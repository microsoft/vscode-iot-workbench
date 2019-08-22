/**
 * UIUtility.ts handles utility function for UI interaction.
 */
'use strict';
import * as vscode from 'vscode';
import * as path from 'path';

import {FileUtility} from './FileUtility';
import {FileNames, ScaffoldType} from './constants';
import {Platform} from './Models/Interfaces/ProjectTemplate';

export async function selectPlatform(
    type: ScaffoldType,
    context: vscode.ExtensionContext): Promise<vscode.QuickPickItem|undefined> {
  const platformListPath = context.asAbsolutePath(path.join(
      FileNames.resourcesFolderName, FileNames.templatesFolderName,
      FileNames.platformListFileName));
  const platformListJsonString =
      await FileUtility.readFile(type, platformListPath, 'utf8') as string;
  const platformListJson = JSON.parse(platformListJsonString);

  if (!platformListJson) {
    throw new Error('Fail to load platform list.');
  }

  const platformList: vscode.QuickPickItem[] = [];

  platformListJson.platforms.forEach((platform: Platform) => {
    platformList.push(
        {label: platform.name, description: platform.description});
  });

  const platformSelection = await vscode.window.showQuickPick(platformList, {
    ignoreFocusOut: true,
    matchOnDescription: true,
    matchOnDetail: true,
    placeHolder: 'Select a platform',
  });

  return platformSelection;
}