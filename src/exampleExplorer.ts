'use strict';

import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';
import {Example} from './Models/Interfaces/Example';
import request = require('request-promise');
import unzip = require('unzip');
import {setInterval, setTimeout} from 'timers';
import {IoTDevSettings} from './IoTSettings';
import * as utils from './utils';

const GALLERY_INDEX =
    'https://raw.githubusercontent.com/VSChina/azureiotdevkit_tools/gallery/example_gallery.json';

export class ExampleExplorer {
  private exampleList: Example[];

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
    if (!this.exampleList) {
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

  private GenerateExampleFolder(exampleName: string): string {
    const settings: IoTDevSettings = new IoTDevSettings();
    if (!utils.directoryExistsSync(settings.defaultProjectsPath)) {
      utils.mkdirRecursivelySync(settings.defaultProjectsPath);
    }

    let counter = 0;
    const name = path.join(
        settings.defaultProjectsPath, 'generated_examples', exampleName);
    let candidateName = name;
    while (true) {
      if (!utils.fileExistsSync(candidateName) &&
          !utils.directoryExistsSync(candidateName)) {
        utils.mkdirRecursivelySync(candidateName);
        return candidateName;
      }
      counter++;
      candidateName = `${name}_${counter}`;
    }
  }


  async initializeExample(
      context: vscode.ExtensionContext,
      channel: vscode.OutputChannel): Promise<boolean> {
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

    const result = this.exampleList.filter((item: Example) => {
      return item.name === selection.label;
    });

    if (!result) {
      return false;
    }

    const url = result[0].url;
    const fsPath = this.GenerateExampleFolder(result[0].name);

    if (!fsPath) {
      return false;
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
      return false;
    }
  }
}