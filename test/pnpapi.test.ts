'use strict';

import * as assert from 'assert';
import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {SearchResults} from '../src/DigitalTwin/DigitalTwinApi/DataContracts/SearchResults';
import {DigitalTwinMetamodelRepositoryClient} from '../src/DigitalTwin/DigitalTwinApi/DigitalTwinMetamodelRepositoryClient';

import {TestExtensionContext} from './stub';
import {DigitalTwinSharedAccessKey} from '../src/DigitalTwin/DigitalTwinApi/DigitalTwinSharedAccessKey';
import {DigitalTwinConnectionStringBuilder} from '../src/DigitalTwin/DigitalTwinApi/DigitalTwinConnectionStringBuilder';

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

    const pnpSharedAccessKey = new DigitalTwinSharedAccessKey(
        DigitalTwinConnectionStringBuilder.Create(constants.connectionString));

    const result = pnpSharedAccessKey.GenerateSASToken();
    assert.equal(result.length > 0, true);
  });



  // tslint:disable-next-line: only-arrow-functions
  test('Should be able to get all interfaces', async function() {
    const context = new TestExtensionContext();
    this.timeout(60 * 1000);

    const builder =
        DigitalTwinConnectionStringBuilder.Create(constants.connectionString);
    const pnpMetamodelRepositoryClient =
        new DigitalTwinMetamodelRepositoryClient(constants.connectionString);

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
    const pnpMetamodelRepositoryClient =
        new DigitalTwinMetamodelRepositoryClient(null);
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
        DigitalTwinConnectionStringBuilder.Create(constants.connectionString);
    const pnpMetamodelRepositoryClient =
        new DigitalTwinMetamodelRepositoryClient(constants.connectionString);
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
        DigitalTwinConnectionStringBuilder.Create(constants.connectionString);
    const pnpMetamodelRepositoryClient =
        new DigitalTwinMetamodelRepositoryClient(constants.connectionString);

    const sampleInterfacePath =
        path.join(constants.sampleFolderPath, constants.sampleIntefaceName);

    const data = fs.readFileSync(sampleInterfacePath, 'utf8');
    assert.equal(data.length > 0, true);

    const newinteface =
        data.replace('1.0.0', `1.0.${Math.floor(Math.random() * 1000000)}`);

    const fileJson = JSON.parse(newinteface);
    const fileId = fileJson['@id'];
    const result =
        await pnpMetamodelRepositoryClient.CreateOrUpdateInterfaceAsync(
            newinteface, fileId, undefined, builder.RepositoryIdValue);

    assert.equal(result.length > 0, true);

    const interfaceContext =
        await pnpMetamodelRepositoryClient.GetInterfaceAsync(
            fileId, builder.RepositoryIdValue, true);

    const updatedResult =
        await pnpMetamodelRepositoryClient.CreateOrUpdateInterfaceAsync(
            newinteface, fileId, interfaceContext.etag,
            builder.RepositoryIdValue);

    assert.equal(updatedResult !== result, true);

    await pnpMetamodelRepositoryClient.DeleteInterfaceAsync(
        fileId, builder.RepositoryIdValue);
    if (fileId) {
      try {
        await pnpMetamodelRepositoryClient.GetInterfaceAsync(
            fileId, builder.RepositoryIdValue, true);
      } catch (error) {
        assert.equal(error.statusCode, 404);
      }
    }
  });
});
