'use strict';

import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';
import {Example} from './Models/Interfaces/Example';
import request = require('request-promise');
import unzip = require('unzip');
import {setInterval, setTimeout} from 'timers';

const GALLERY_INDEX =
    'https://raw.githubusercontent.com/VSChina/azureiotdevkit_tools/gallery/example_gallery.json';

export class ExampleExplorer {
  private examleList: vscode.QuickPickItem[];

  private async getCurrentPath(): Promise<string|undefined> {
    if (!vscode.workspace.rootPath) {
      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: 'Select',
        canSelectFolders: true,
        canSelectFiles: false
      };

      const folderUri = await vscode.window.showOpenDialog(options);
      if (!folderUri) {
        return undefined;
      }

      const uri = vscode.Uri.parse(folderUri[0].fsPath);
      vscode.commands.executeCommand('vscode.openFolder', uri);
      return folderUri[0].fsPath;
    } else {
      return vscode.workspace.rootPath;
    }
  }

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
      url: string, fsPath: string): Promise<void> {
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

    stream.on('finish', () => {
      clearInterval(loading);
      channel.appendLine('');
      channel.appendLine('Example loaded.');
      setTimeout(async () => {
        await this.moveTempFiles(fsPath);
        Promise.resolve();
      }, 1000);
    });

    stream.on('error', (error: Error) => {
      clearInterval(loading);
      channel.appendLine('');
      Promise.reject(error);
    });
  }

  private async getExampleList(): Promise<vscode.QuickPickItem[]> {
    if (this.examleList) {
      return this.examleList;
    }
    const _list =
        (JSON.parse(await request(GALLERY_INDEX).promise() as string)) as
        Example[];
    const exampleList: vscode.QuickPickItem[] = [];
    _list.forEach((item: Example) => {
      exampleList.push(
          {label: item.name, description: item.name, detail: item.url});
    });
    return exampleList;
  }

  async initializeExample(
      context: vscode.ExtensionContext,
      channel: vscode.OutputChannel): Promise<boolean> {
    const fsPath = await this.getCurrentPath();

    if (!fsPath) {
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
      return false;
    }

    const url = selection.detail;

    const files = fs.readdirSync(fsPath);
    if (files && files[0]) {
      vscode.window.showInformationMessage(
          'We need an empty folder to load the example. ' +
          'Please provide an empty folder');
      return false;
    }

    channel.appendLine('Downloading example package...');
    await this.downloadExamplePackage(context, channel, url, fsPath);
    await vscode.commands.executeCommand(
        'arduino.iotStudioInitialize', path.join(fsPath, 'Device'));
    return true;
  }
}