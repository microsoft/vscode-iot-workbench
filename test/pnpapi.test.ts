'use strict';

import * as assert from 'assert';
import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {SearchResults} from '../src/pnp/pnp-api/DataContracts/SearchResults';
import {PnPMetamodelRepositoryClient} from '../src/pnp/pnp-api/PnPMetamodelRepositoryClient';

import {TestExtensionContext} from './stub';
import {PnPSharedAccessKey} from '../src/pnp/pnp-api/PnPSharedAccessKey';
import {PnPConnectionStringBuilder} from '../src/pnp/pnp-api/PnPConnectionStringBuilder';

const constants = {
  connectionString: '',
  sampleFolderPath:
      path.join(__dirname, '../../test/resources/PnPTestInputFiles'),
  sampleIntefaceName: 'MxChipInterface.json',
  sampleCapabilityModelName: 'MxChipCapabilityModel.json'
};


suite('IoT Workbench: PnPAPI', () => {
  test('Should be able generate shared access key', async function() {
    const context = new TestExtensionContext();
    this.timeout(60 * 1000);

    const pnpSharedAccessKey = new PnPSharedAccessKey(
        PnPConnectionStringBuilder.Create(constants.connectionString));

    const result = pnpSharedAccessKey.GenerateSASToken();
    assert.equal(result.length > 0, true);
  });



  // tslint:disable-next-line: only-arrow-functions
  test('Should be able to get all interfaces', async function() {
    const context = new TestExtensionContext();
    this.timeout(60 * 1000);

    const builder =
        PnPConnectionStringBuilder.Create(constants.connectionString);
    const pnpMetamodelRepositoryClient =
        new PnPMetamodelRepositoryClient(constants.connectionString);

    const result = await pnpMetamodelRepositoryClient.SearchInterfacesAsync(
        '', null, builder.RepositoryIdValue, 50);
    assert.equal(result.results.length <= 50, true);
    assert.equal(result.results.length >= 0, true);

    if (result && result.continuationToken) {
      const newResult =
          await pnpMetamodelRepositoryClient.SearchInterfacesAsync(
              '', result.continuationToken, builder.RepositoryIdValue, 50);
      assert.equal(newResult.results.length <= 50, true);
      assert.equal(newResult.results.length > 0, true);
    }
  });

  test('should be able to get the interface content', async function() {
    this.timeout(10 * 60 * 1000);
    const pnpMetamodelRepositoryClient = new PnPMetamodelRepositoryClient(null);
    const searchResults: SearchResults =
        await pnpMetamodelRepositoryClient.SearchInterfacesAsync(
            '', null, undefined, 50);

    if (searchResults.results.length > 0) {
      const sampleUri = searchResults.results[0].id;
      // get the interface by interfaceId.
      const interfaceContext =
          await pnpMetamodelRepositoryClient.GetInterfaceAsync(
              sampleUri, undefined, true);

      assert.equal((interfaceContext.contents as string).length > 0, true);
    }

    const fakeModelId = 'http://1223.123/interfaces/mxchip/1.0.011122';
    try {
      await pnpMetamodelRepositoryClient.GetInterfaceAsync(
          fakeModelId, undefined, false);
      throw new Error('should not happen');
    } catch (error) {
      assert.equal(error.statusCode, 404);
    }
  });

  test('should be able to get the capability model content', async function() {
    this.timeout(10 * 60 * 1000);
    const builder =
        PnPConnectionStringBuilder.Create(constants.connectionString);
    const pnpMetamodelRepositoryClient =
        new PnPMetamodelRepositoryClient(constants.connectionString);
    const searchResults: SearchResults =
        await pnpMetamodelRepositoryClient.SearchCapabilityModelsAsync(
            '', null, builder.RepositoryIdValue, 50);

    if (searchResults.results.length > 0) {
      const sampleUri = searchResults.results[0].id;
      // get the interface.
      const templateContext =
          await pnpMetamodelRepositoryClient.GetCapabilityModelAsync(
              sampleUri, builder.RepositoryIdValue, true);
      assert.equal((templateContext.contents as string).length > 0, true);

      const templateContext2 =
          await pnpMetamodelRepositoryClient.GetCapabilityModelAsync(
              sampleUri, builder.RepositoryIdValue, false);
      assert.equal((templateContext2.contents as string).length > 0, true);
    }
  });

  test('should be able to create and delete interface', async function() {
    this.timeout(60 * 1000);
    const builder =
        PnPConnectionStringBuilder.Create(constants.connectionString);
    const pnpMetamodelRepositoryClient =
        new PnPMetamodelRepositoryClient(constants.connectionString);

    const sampleInterfacePath =
        path.join(constants.sampleFolderPath, constants.sampleIntefaceName);

    const data = fs.readFileSync(sampleInterfacePath, 'utf8');
    assert.equal(data.length > 0, true);

    const newinteface =
        data.replace('1.0.0', `1.0.${Math.floor(Math.random() * 1000000)}`);

    const result =
        await pnpMetamodelRepositoryClient.CreateOrUpdateInterfaceAsync(
            newinteface, undefined, builder.RepositoryIdValue);

    assert.equal((result.contents as string).length > 0, true);



    const updatedContext =
        await pnpMetamodelRepositoryClient.CreateOrUpdateInterfaceAsync(
            newinteface, result.etag, builder.RepositoryIdValue);
    assert.equal((updatedContext.contents as string).length > 0, true);
    assert.equal(updatedContext.etag !== result.etag, true);
    assert.equal(updatedContext.id, result.id);

    await pnpMetamodelRepositoryClient.DeleteInterfaceAsync(
        result.id, builder.RepositoryIdValue);
    if (result.id) {
      try {
        await pnpMetamodelRepositoryClient.GetInterfaceAsync(
            result.id, builder.RepositoryIdValue, true);
      } catch (error) {
        assert.equal(error.statusCode, 404);
      }
    }
  });
});
