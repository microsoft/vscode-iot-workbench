import * as assert from 'assert';
import * as vscode from 'vscode';

import {ConfigHandler} from '../src/configHandler';
import {ConfigKey} from '../src/constants';


suite('IoT Workbench: Config', () => {
  test('should set and get config value correctly', function(done) {
    this.timeout(60 * 1000);
    try {
      assert.equal(ConfigHandler.get<string>(ConfigKey.boardId), 'devkit');
      assert.equal(ConfigHandler.get<string>(ConfigKey.devicePath), 'Device');
      ConfigHandler.update(ConfigKey.boardId, 'IoTButton');
      assert.equal(ConfigHandler.get<string>(ConfigKey.boardId), 'devkit');
      ConfigHandler.update(ConfigKey.boardId, 'devkit');
      done();

    } catch (error) {
      done(new Error(error));
    }
  });
});