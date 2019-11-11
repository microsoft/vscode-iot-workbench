const fs = require('fs');

if (process.env.TRAVIS_TAG) {
  const ISTESTVERSION = /^v?[0-9]+\.[0-9]+\.[0-9]+-[rR][cC]$/.test(process.env.TRAVIS_TAG || '');
  if (ISTESTVERSION) {
    // 1. Modify package.json
    const packageJson = JSON.parse(fs.readFileSync('package.json'));

    const testName = "test-iot-workbench";
    const testDisplayName = "Test IoT Workbench";
    const testPublisher = "IoTDevExBuild";
    packageJson.name = testName;
    packageJson.displayName = testDisplayName;
    packageJson.publisher = testPublisher;
    packageJson.version = packageJson.version.slice(0, -3);

    delete packageJson.icon;
    delete packageJson.aiKey;

    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');


    // 2. Modify extensionId in files
    const extensionIdPattern = /vsciot-vscode.vscode-iot-workbench/g;
    const rcExtensionId = 'iotdevexbuild.test-iot-workbench';

    const constantFilePath = "src/constants.ts";
    const arm7DevcontainerJsonFile = "resources/templates/arm7/devcontainer.json";
    const arm8DevcontainerJsonFile = "resources/templates/arm8/devcontainer.json";
    const x86DevcontainerJsonFile = "resources/templates/x86/devcontainer.json";
    const files = [constantFilePath, arm7DevcontainerJsonFile, arm8DevcontainerJsonFile, x86DevcontainerJsonFile];
    files.forEach(filePath => {
      const originalJsonFile = fs.readFileSync(filePath).toString();
      const replaceJson = originalJsonFile.replace(extensionIdPattern, rcExtensionId);
      fs.writeFileSync(filePath, replaceJson);
    });
  }
}