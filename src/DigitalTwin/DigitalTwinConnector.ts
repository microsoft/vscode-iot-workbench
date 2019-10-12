// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';

import {ConfigKey} from '../constants';
import {CredentialStore} from '../credentialStore';

import {DigitalTwinConnectionStringBuilder} from './DigitalTwinApi/DigitalTwinConnectionStringBuilder';
import {DigitalTwinMetamodelRepositoryClient} from './DigitalTwinApi/DigitalTwinMetamodelRepositoryClient';
import {DigitalTwinConstants} from './DigitalTwinConstants';

export class DigitalTwinConnector {
  static async connectMetamodelRepository(connectionString: string):
      Promise<boolean> {
    if (!connectionString) {
      throw new Error(
          'The connection string could not be empty. Please provide a valid connection string');
    }

    try {
      const dtMetamodelRepositoryClient =
          new DigitalTwinMetamodelRepositoryClient();
      await dtMetamodelRepositoryClient.initialize(connectionString);
      const builder =
          DigitalTwinConnectionStringBuilder.create(connectionString);
      // try to get one interface.
      const result = await dtMetamodelRepositoryClient.searchInterfacesAsync(
          '', null, builder.repositoryIdValue, 1);
      // Save connection string info
      await CredentialStore.setCredential(
          ConfigKey.modelRepositoryKeyName, connectionString);
      vscode.window.showInformationMessage(`Connect to ${
          DigitalTwinConstants.productName} Model Repository successfully.`);
      return true;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to connect to ${
          DigitalTwinConstants.productName} Model Repository, error: ${error}`);
      return false;
    }
  }
}
