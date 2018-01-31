import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

const rootPath = vscode.workspace.rootPath;
const configFilePath =
    rootPath ? path.join(rootPath as string, 'iotstudio.config.json') : null;

function getConfigObject() {
  if (!configFilePath) {
    throw new Error(
        'Unable to find the root path, please open an IoT Studio project.');
  }

  let configString;

  try {
    configString = fs.readFileSync(configFilePath as string, 'utf8');
  } catch (e) {
    configString = '';
  }

  let configObject;
  try {
    configObject = configString ? JSON.parse(configString) : {};
  } catch (e) {
    throw new Error('Project config is not a valid JSON file.');
  }

  return configObject;
}

export class ConfigHandler {
  static update(key: string, value: {}) {
    if (!key) {
      throw new Error('Key is empty.');
    }

    return vscode.workspace.getConfiguration('IoTStudio').update(key, value);
  }

  static get<T>(key: string) {
    if (!key) {
      throw new Error('Key is empty.');
    }

    return vscode.workspace.getConfiguration('IoTStudio').get<T>(key);
  }
}