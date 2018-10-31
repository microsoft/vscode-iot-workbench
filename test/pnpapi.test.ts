'use strict';

import * as assert from 'assert';
import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';

import {SearchResults} from '../src/pnp/pnp-api/DataContracts/SearchResults';
import {PnPConnectionString} from '../src/pnp/pnp-api/PnPConnectionString';
import {PnPConnectionStringBuilder} from '../src/pnp/pnp-api/PnPConnectionStringBuilder';
import {PnPMetamodelRepositoryClient} from '../src/pnp/pnp-api/PnPMetamodelRepositoryClient';
import {PnPUri} from '../src/pnp/pnp-api/Validator/PnPUri';

import {TestExtensionContext} from './stub';
import {PnPContext} from '../src/pnp/pnp-api/DataContracts/PnPContext';

const constants = {
  connectionString:
      'HostName=iotpnptest.azurewebsites.net;SharedAccessKeyName=pnptest;SharedAccessKey={access key}}',
  sampleFolderPath:
      path.join(__dirname, '../../test/resources/PnPTestInputFiles'),
  sampleIntefaceName: 'MxChipInterface.json',
  sampleTemplateName: 'MxChipTemplate.json'
};


suite('IoT Workbench: PnPAPI', () => {
  // tslint:disable-next-line: only-arrow-functions
  test('Should be able to get all interfaces', async function() {
    const context = new TestExtensionContext();
    this.timeout(60 * 1000);

    const pnpMetamodelRepositoryClient =
        new PnPMetamodelRepositoryClient(constants.connectionString);
    const result =
        await pnpMetamodelRepositoryClient.GetAllInterfacesAsync(null, 50);
    assert.equal(result.results.length <= 50, true);
    assert.equal(result.results.length > 0, true);

    if (result && result.continuationToken) {
      const newResult =
          await pnpMetamodelRepositoryClient.GetAllInterfacesAsync(
              result.continuationToken, 50);
      assert.equal(newResult.results.length <= 50, true);
      assert.equal(newResult.results.length > 0, true);
    }
  });

  test('should be able to get the interface content', async function() {
    this.timeout(10 * 60 * 1000);
    const pnpMetamodelRepositoryClient =
        new PnPMetamodelRepositoryClient(constants.connectionString);
    const searchResults: SearchResults =
        await pnpMetamodelRepositoryClient.GetAllInterfacesAsync(null, 50);

    if (searchResults.results.length > 0) {
      const sampleUri = searchResults.results[0].id;
      // get the interface by interfaceId.
      const interfaceContext =
          await pnpMetamodelRepositoryClient.GetInterfaceByInterfaceIdAsync(
              PnPUri.Parse(sampleUri));
      assert.equal(interfaceContext.content.length > 0, true);

      if (interfaceContext.resourceId) {
        const newInterfaceContext =
            await pnpMetamodelRepositoryClient.GetInterfaceByResourceIdAsync(
                interfaceContext.resourceId);
        assert.equal(
            interfaceContext.content.length,
            newInterfaceContext.content.length);
        assert.equal(interfaceContext.etag, newInterfaceContext.etag);
      } else {
        throw new Error('should not happen');
      }
    }

    const fakeResourceId = '123456789_123456789';
    try {
      await pnpMetamodelRepositoryClient.GetInterfaceByResourceIdAsync(
          fakeResourceId);
      throw new Error('should not happen');
    } catch (error) {
      assert.equal(error.statusCode, 404);
    }
  });

  test('should be able to get the template content', async function() {
    this.timeout(10 * 60 * 1000);
    const pnpMetamodelRepositoryClient =
        new PnPMetamodelRepositoryClient(constants.connectionString);
    const searchResults: SearchResults =
        await pnpMetamodelRepositoryClient.GetAllTemplatesAsync(null, 50);

    if (searchResults.results.length > 0) {
      const sampleUri = searchResults.results[0].id;
      // get the interface.
      const templateContext =
          await pnpMetamodelRepositoryClient.GetTemplateByTemplateIdAsync(
              PnPUri.Parse(sampleUri));
      assert.equal(templateContext.content.length > 0, true);
    }
  });

  test('should be able to create and delete interface', async function() {
    this.timeout(60 * 1000);
    const pnpMetamodelRepositoryClient =
        new PnPMetamodelRepositoryClient(constants.connectionString);

    const sampleInterfacePath =
        path.join(constants.sampleFolderPath, constants.sampleIntefaceName);

    const data = fs.readFileSync(sampleInterfacePath, 'utf8');
    assert.equal(data.length > 0, true);

    const newinteface =
        data.replace('1.0.0', `1.0.${Math.floor(Math.random() * 1000000)}`);

    const pnpContext:
        PnPContext = {resourceId: '', content: newinteface, etag: ''};

    const result: PnPContext =
        await pnpMetamodelRepositoryClient.CreateInterfaceAsync(pnpContext);

    assert.equal(result.content.length > 0, true);
    assert.equal(result.resourceId === null, false);

    if (result.resourceId) {
      const context =
          await pnpMetamodelRepositoryClient.GetInterfaceByResourceIdAsync(
              result.resourceId);
      assert.equal(context.content.length > 0, true);
      assert.equal(context.published, false);

      // update the interface
      const newContext: PnPContext = {
        resourceId: context.resourceId,
        etag: context.etag,
        content: newinteface
      };

      const updatedContext =
          await pnpMetamodelRepositoryClient.UpdateInterface(newContext);
      assert.equal(updatedContext.content.length > 0, true);
      assert.equal(updatedContext.published, false);
      assert.equal(updatedContext.etag !== newContext.etag, true);
      assert.equal(updatedContext.resourceId, newContext.resourceId);

      /*await
      pnpMetamodelRepositoryClient.DeleteInterfaceByResourceIdAsync(result.resourceId);

      assert.throws(async ()=>{
        if(result.resourceId){
          await
      pnpMetamodelRepositoryClient.GetInterfaceByResourceIdAsync(result.resourceId);
        }
      });*/
    }
  });
});
