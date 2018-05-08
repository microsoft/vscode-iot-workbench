//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('IoT Workbench: Commands Tests', () => {
  // tslint:disable-next-line: only-arrow-functions
  setup(function(done) {
    // Ensure that extension is activate while testing
    this.timeout(60 * 1000);
    const extension =
        vscode.extensions.getExtension('vsciot-vscode.vscode-iot-workbench');
    if (!extension) {
      done('Failed to activate extension');
    } else if (!extension.isActive) {
      extension.activate().then(
          (api) => {
            done();
          },
          () => {
            done('Failed to activate extension');
          });
    } else {
      done();
    }
  });

  // tslint:disable-next-line: only-arrow-functions
  test(
      'should be able to run command: iotworkbench.exampleInitialize',
      function(done) {
        this.timeout(60 * 1000);
        try {
          vscode.commands.executeCommand('iotworkbench.exampleInitialize')
              .then((result) => {
                done();
              });

        } catch (error) {
          done(new Error(error));
        }
      });

  // tslint:disable-next-line: only-arrow-functions
  test('should be able to run command: iotworkbench.help', function(done) {
    this.timeout(60 * 1000);
    try {
      vscode.commands.executeCommand('iotworkbench.help').then((result) => {
        done();
      });

    } catch (error) {
      done(new Error(error));
    }
  });
});
