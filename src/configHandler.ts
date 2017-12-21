import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {ExceptionHelper} from './exceptionHelper';

const rootPath = vscode.workspace.rootPath;
const configFilePath =
    rootPath ? path.join(rootPath as string, 'iotstudio.config.json') : null;

function getConfigObject() {
  if (!configFilePath) {
    ExceptionHelper.logError(
        'Unable to find the root path, please open an IoT Studio project.',
        true);
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
    ExceptionHelper.logError('Project config is not a valid JSON file.', true);
  }

  return configObject;
}

export class ConifgHandler {
  static update(key: string, value: {}) {
    if (!key) {
      ExceptionHelper.logError('Key is empty.', true);
    }

    const configObject = getConfigObject();
    configObject[key] = value;

    let stringToSave;

    try {
      stringToSave = JSON.stringify(configObject, null, 4);
    } catch (e) {
      ExceptionHelper.logError('Value is not a valid JSON object.', true);
    }

    if (!stringToSave) {
      ExceptionHelper.logError('Value is not a valid JSON object.', true);
    }

    try {
      fs.writeFileSync(
          configFilePath as string, stringToSave as string, 'utf8');
    } catch (e) {
      ExceptionHelper.logError(
          'Fail to update config file. Pleace check your permission.', true);
    }
  }

  static get(key: string) {
    if (!key) {
      ExceptionHelper.logError('Key is empty.', true);
    }

    const configObject = getConfigObject();
    return configObject[key];
  }
}