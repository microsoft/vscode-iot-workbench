import * as assert from 'assert';
import {results} from 'azure-iot-common';
import * as Path from 'path';
import * as vscode from 'vscode';

import {SearchResults} from '../src/pnp/pnp-api/DataContracts/SearchResults';
import {PnPConnectionString} from '../src/pnp/pnp-api/PnPConnectionString';
import {PnPConnectionStringBuilder} from '../src/pnp/pnp-api/PnPConnectionStringBuilder';
import {PnPMetamodelRepositoryClient} from '../src/pnp/pnp-api/PnPMetamodelRepositoryClient';
import {PnPUri} from '../src/pnp/pnp-api/Validator/PnPUri';

import {TestExtensionContext} from './stub';


const constants = {
  connectionString:
      'HostName=iotpnptest.azurewebsites.net;SharedAccessKeyName=pnptest;SharedAccessKey={access key}'
};


suite('IoT Workbench: PnPAPI', () => {
  // tslint:disable-next-line: only-arrow-functions
  test('Should be able to get all interfaces', function(done) {
    const context = new TestExtensionContext();
    this.timeout(60 * 1000);

    try {
      const pnpMetamodelRepositoryClient =
          new PnPMetamodelRepositoryClient(constants.connectionString);
      pnpMetamodelRepositoryClient.GetAllInterfacesAsync(null, 50).then(
          (result) => {
            assert.equal(result.results.length <= 50, true);
            assert.equal(result.results.length > 0, true);
            done();
          });
    } catch (error) {
      done(new Error(error));
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
      // get the interface.
      const interfaceContext =
          await pnpMetamodelRepositoryClient.GetInterfaceByInterfaceIdAsync(
              PnPUri.Parse(sampleUri));
      assert.equal(interfaceContext.content.length > 0, true);
    }
  });
});
