'use strict';

import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';
import {Example} from './Models/Interfaces/Example';
import request = require('request-promise');
import unzip = require('unzip');
import {setInterval, setTimeout} from 'timers';
import {IoTWorkbenchSettings} from './IoTSettings';
import * as utils from './utils';
import {Board} from './Models/Interfaces/Board';

const GALLERY_INDEX =
    'https://raw.githubusercontent.com/VSChina/azureiotdevkit_tools/gallery/example_gallery.json';


const constants = {
  boardListFileName: 'boardlist.json',
  resourceFolderName: 'resources',
};

export class ExampleExplorer {
  private exampleList: Example[] = [];

  private async moveTempFiles(fsPath: string) {
    const tempPath = path.join(fsPath, '.temp');
    const tempPathList = fs.listSync(tempPath);
    let examplePath: string|undefined = undefined;
    for (let i = 0; i < tempPathList.length; i++) {
      if (!/\.zip$/.test(tempPathList[i])) {
        examplePath = tempPathList[i];
        break;
      }
    }
    if (!examplePath) {
      return false;
    }

    const examplePathList = fs.readdirSync(examplePath);

    examplePathList.forEach(item => {
      if (item !== '.' && item !== '..') {
        try {
          fs.moveSync(
              path.join(examplePath as string, item), path.join(fsPath, item));
        } catch (error) {
          throw error;
        }
      }
    });

    try {
      fs.removeSync(tempPath);
    } catch (error) {
      throw error;
    }

    return true;
  }

  private async downloadExamplePackage(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel,
      url: string, fsPath: string): Promise<boolean> {
    channel.show();
    const loading = setInterval(() => {
      channel.append('.');
    }, 1000);

    const options: request.OptionsWithUri = {
      method: 'GET',
      uri: url,
      encoding: null  // Binary data
    };

    const zipData = await request(options).promise() as string;
    const tempPath = path.join(fsPath, '.temp');
    fs.writeFileSync(path.join(tempPath, 'example.zip'), zipData);
    const stream = fs.createReadStream(path.join(tempPath, 'example.zip'))
                       .pipe(unzip.Extract({path: tempPath}));

    return new Promise(
        (resolve: (value: boolean) => void,
         reject: (reason: Error) => void) => {
          stream.on('finish', () => {
            clearInterval(loading);
            channel.appendLine('');
            channel.appendLine('Example loaded.');
            setTimeout(async () => {
              await this.moveTempFiles(fsPath);
              resolve(true);
            }, 1000);
          });

          stream.on('error', (error: Error) => {
            clearInterval(loading);
            channel.appendLine('');
            reject(error);
          });
        });
  }

  private async getExampleList(): Promise<vscode.QuickPickItem[]> {
    if (!this.exampleList.length) {
      this.exampleList =
          (JSON.parse(await request(GALLERY_INDEX).promise() as string)) as
          Example[];
    }

    const itemList: vscode.QuickPickItem[] = [];
    this.exampleList.forEach((item: Example) => {
      itemList.push({
        label: item.name,
        description: item.description,
        detail: item.detail
      });
    });
    return itemList;
  }

  private async GenerateExampleFolder(exampleName: string) {
    const settings: IoTWorkbenchSettings = new IoTWorkbenchSettings();
    const workbench = await settings.workbenchPath();
    if (!workbench) {
      return undefined;
    }

    if (!utils.directoryExistsSync(workbench)) {
      utils.mkdirRecursivelySync(workbench);
    }

    const name = path.join(workbench, 'examples', exampleName);
    if (!utils.fileExistsSync(name) && !utils.directoryExistsSync(name)) {
      utils.mkdirRecursivelySync(name);
      return name;
    }

    const workspaceFile = path.join(name, 'project.code-workspace');
    if (fs.existsSync(workspaceFile)) {
      const selection = await vscode.window.showQuickPick(
          [
            {label: `Open existing example`, description: ''},
            {label: 'Generate a new example', description: ''}
          ],
          {
            ignoreFocusOut: true,
            matchOnDescription: true,
            matchOnDetail: true,
            placeHolder: 'Select an option',
          });

      if (!selection) {
        return '';
      }

      if (selection.label === 'Open existing example') {
        return name;
      }
    }

    const customizedName = await vscode.window.showInputBox({
      prompt: 'Input example folder name',
      ignoreFocusOut: true,
      validateInput: (exampleName: string) => {
        const name = path.join(workbench, 'examples', exampleName);
        if (!utils.fileExistsSync(name) && !utils.directoryExistsSync(name)) {
          if (!/^([a-z0-9_]|[a-z0-9_][-a-z0-9_.]*[a-z0-9_])$/i.test(
                  exampleName)) {
            return 'Folder name can only contain letters, numbers, "-" and ".", and cannot start or end with "-" or ".".';
          }
          return;
        } else {
          const items = fs.listSync(name);
          if (items.length === 0) {
            return;
          }
          return `${exampleName} exists, please use other folder name.`;
        }
      }
    });

    if (!customizedName) {
      return '';
    }

    const customizedPath = path.join(workbench, 'examples', customizedName);
    if (!utils.fileExistsSync(customizedPath) &&
        !utils.directoryExistsSync(customizedPath)) {
      utils.mkdirRecursivelySync(customizedPath);
    }

    return customizedPath;
  }


  async initializeExample(
      context: vscode.ExtensionContext,
      channel: vscode.OutputChannel): Promise<boolean> {
    // Select board
    const boardItemList: vscode.QuickPickItem[] = [];
    const boardList = context.asAbsolutePath(
        path.join(constants.resourceFolderName, constants.boardListFileName));
    const boardsJson = require(boardList);
    boardsJson.boards.forEach((board: Board) => {
      boardItemList.push({
        label: board.name,
        description: board.platform,
      });
    });

    const boardSelection = await vscode.window.showQuickPick(boardItemList, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: 'Select a board',
    });

    if (!boardSelection) {
      return false;
    }

    const list = this.getExampleList();
    const selection = await vscode.window.showQuickPick(list, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: 'Select an example',
    });

    if (!selection || !selection.detail) {
      channel.appendLine('The operation of selecting example cancelled.');
      return false;
    }

    const result = this.exampleList.filter((item: Example) => {
      return item.name === selection.label;
    });

    if (!result) {
      channel.appendLine(`Unable to load the example with name:${
          selection.label}, please retry.`);
      return false;
    }

    const url = result[0].url;
    const fsPath = await this.GenerateExampleFolder(result[0].name);

    if (fsPath === undefined) {
      channel.appendLine(
          'Unable to create folder for examples, please check the workbench settings.');
      return false;
    }

    if (!fsPath) {
      return false;
    }

    const items = fs.listSync(fsPath);
    if (items.length !== 0) {
      await vscode.commands.executeCommand(
          'vscode.openFolder',
          vscode.Uri.file(path.join(fsPath, 'project.code-workspace')), true);
      return true;
    }

    channel.appendLine('Downloading example package...');
    const res =
        await this.downloadExamplePackage(context, channel, url, fsPath);
    if (res) {
      // Follow the same pattern in Arduino extension to open examples in new
      // VSCode instance
      await vscode.commands.executeCommand(
          'vscode.openFolder',
          vscode.Uri.file(path.join(fsPath, 'project.code-workspace')), true);
      return true;
    } else {
      channel.appendLine(
          'Downloading example package failed. Please check your network settings.');
      return false;
    }
  }
}