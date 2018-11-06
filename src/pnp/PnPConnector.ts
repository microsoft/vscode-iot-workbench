// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import {PnPMetamodelRepositoryClient} from './pnp-api/PnPMetamodelRepositoryClient';
import {PnPConstants} from './PnPConstants';


export class PnPConnector {
  static async ConnectMetamodelRepository(
      context: vscode.ExtensionContext,
      connectionString: string): Promise<boolean> {
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
      context.workspaceState.update(
          PnPConstants.modelRepositoryKeyName, connectionString);
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
