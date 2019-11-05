const fs = require('fs');

if (process.env.TRAVIS_TAG) {
  const ISTESTVERSION = /^v?[0-9]+\.[0-9]+\.[0-9]+-[rR][cC]$/.test(process.env.TRAVIS_TAG || '');
  const packageJson = JSON.parse(fs.readFileSync('package.json'));
  if (ISTESTVERSION) {
    // Modify
    const testName = "test-iot-workbench";
    const testDisplayName = "Test IoT Workbench";
    const testPublisher = "IoTDevExBuild";
    packageJson.name = testName;
    packageJson.displayName = testDisplayName;
    packageJson.publisher = testPublisher;

    // Delete
    delete packageJson.icon;
    delete packageJson.aiKey;

    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
  }
}