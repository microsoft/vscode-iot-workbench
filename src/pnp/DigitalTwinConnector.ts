// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey} from '../constants';

import {DigitalTwinConnectionStringBuilder} from './DigitalTwinApi/DigitalTwinConnectionStringBuilder';
import {DigitalTwinMetamodelRepositoryClient} from './DigitalTwinApi/DigitalTwinMetamodelRepositoryClient';


export class DigitalTwinConnector {
  static async ConnectMetamodelRepository(connectionString: string):
      Promise<boolean> {
    if (!connectionString) {
      throw new Error(
          'The connection string could not be empty. Please provide a valid connection string');
    }

    try {
      const pnpMetamodelRepositoryClient =
          new DigitalTwinMetamodelRepositoryClient(connectionString);
      const builder =
          DigitalTwinConnectionStringBuilder.Create(connectionString);
      // try to get one interface.
      const result = await pnpMetamodelRepositoryClient.SearchInterfacesAsync(
          '', null, builder.RepositoryIdValue, 1);
      // Save connection string info
      await ConfigHandler.update(
          ConfigKey.pnpModelRepositoryKeyName, connectionString,
          vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
          'Connect to Digital Twin Repository successfully.');
      return true;
    } catch (error) {
      vscode.window.showErrorMessage(
          `Failed to connect to Digital Twin Repository, error: ${error}`);
      return false;
    }
  }
}
