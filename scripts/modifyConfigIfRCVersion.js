const fs = require('fs');

if (process.env.TRAVIS_TAG) {
  const isTestVersion = /^v?[0-9]+\.[0-9]+\.[0-9]+-[rR][cC]/.test(process.env.TRAVIS_TAG || '');
  if (isTestVersion) {
    // 1. Modify package.json
    const packageJson = JSON.parse(fs.readFileSync('package.json'));

    const testName = "test-owl-project";
    const testDisplayName = "Test OWL Project RC";
    const testPublisher = "IoTDevExBuild";
    packageJson.name = testName;
    packageJson.displayName = testDisplayName;
    packageJson.publisher = testPublisher;
    packageJson.aiKey = process.env['TEST_AIKEY'];

    const indexOfDash = packageJson.version.indexOf('-');
    if (indexOfDash > 0) {
      packageJson.version = packageJson.version.substring(0, indexOfDash);
    }

    delete packageJson.icon;

    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');


    // 2. Modify extensionId in template files
    const extensionIdPattern = /vsciot-vscode.vscode-iot-workbench/g;
    const rcExtensionId = 'iotdevexbuild.test-owl-project';

    const arm7DevcontainerJsonFile = "resources/templates/arm7/devcontainer.json";
    const arm8DevcontainerJsonFile = "resources/templates/arm8/devcontainer.json";
    const x86DevcontainerJsonFile = "resources/templates/x86/devcontainer.json";
    const files = [arm7DevcontainerJsonFile, arm8DevcontainerJsonFile, x86DevcontainerJsonFile];
    files.forEach(filePath => {
      const originalJsonFile = fs.readFileSync(filePath).toString();
      const replaceJson = originalJsonFile.replace(extensionIdPattern, rcExtensionId);
      fs.writeFileSync(filePath, replaceJson);
    });
  }
}
