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

    const configObject = getConfigObject();
    configObject[key] = value;

    const stringToSave = JSON.stringify(configObject, null, 4);

    if (!stringToSave) {
      throw new Error('Value is not a valid JSON object.');
    }

    try {
      fs.writeFileSync(
          configFilePath as string, stringToSave as string, 'utf8');
    } catch (e) {
      throw new Error(
          'Fail to update config file. Pleace check your permission.');
    }
  }

  static get(key: string) {
    if (!key) {
      throw new Error('Key is empty.');
    }

    const configObject = getConfigObject();
    return configObject[key];
  }
}