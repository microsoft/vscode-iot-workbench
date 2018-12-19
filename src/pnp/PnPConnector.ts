// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey} from '../constants';

import {PnPMetamodelRepositoryClient} from './pnp-api/PnPMetamodelRepositoryClient';


export class PnPConnector {
  static async ConnectMetamodelRepository(connectionString: string):
      Promise<boolean> {
    if (!connectionString) {
      throw new Error(
          'The connection string could not be empty. Please provide a valid connection string');
    }

    try {
      const pnpMetamodelRepositoryClient =
          new PnPMetamodelRepositoryClient(connectionString);
      // try to get one interface.
      const result =
          await pnpMetamodelRepositoryClient.GetAllInterfacesAsync(null, 1);
      await ConfigHandler.update(
          ConfigKey.pnpModelRepositoryKeyName, connectionString,
          vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
          'Connect to Metamodel Repository successfully.');
      // Save connection string into
      return true;
    } catch (error) {
      vscode.window.showErrorMessage(
          `Unable to connect to Metamodel Repository, error: ${error}`);
      return false;
    }
  }
}
