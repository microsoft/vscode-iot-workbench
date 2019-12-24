const fs = require('fs');

if (process.env.TRAVIS_EVENT_TYPE === "cron" || process.env.TRAVIS_TAG) {
  const packageJson = JSON.parse(fs.readFileSync('package.json'));

  // Nightly Build
  if (process.env.TRAVIS_EVENT_TYPE === "cron") {
    const nightlyBuildName = "vscode-iot-workbench-nightly";
    const nightlyBuildDisplayName = "Azure IoT Device Workbench (Nightly)";
    packageJson.name = nightlyBuildName;
    packageJson.displayName = nightlyBuildDisplayName;
    packageJson.aiKey = process.env['TEST_AIKEY'];
    trimVersionNumer(packageJson);
  } else if (process.env.TRAVIS_TAG) {
    const isProdction = /^v?[0-9]+\.[0-9]+\.[0-9]+$/.test(process.env.TRAVIS_TAG || '');
    const isTestVersion = /^v?[0-9]+\.[0-9]+\.[0-9]+-[rR][cC]/.test(process.env.TRAVIS_TAG || '');

    if (isProdction) {
      // Update resource link
      const codeGenUrl = "https://aka.ms/iot-codegen-cli-for-workbench";
      packageJson.codeGenConfigUrl = codeGenUrl;

      // Update production AI Key
      packageJson.aiKey = process.env['PROD_AIKEY'];
    } else if (isTestVersion) {
      const testName = "test-owl-project";
      const testDisplayName = "Test OWL Project RC";
      const testPublisher = "IoTDevExBuild";
      packageJson.name = testName;
      packageJson.displayName = testDisplayName;
      packageJson.publisher = testPublisher;
      packageJson.aiKey = process.env['TEST_AIKEY'];
      trimVersionNumer(packageJson);

      delete packageJson.icon;


      // Modify extensionId in template files
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

  fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
}

/**
 * Remove character after '-' in package json version number
 * @param {*} packageJson package json object
 */
function trimVersionNumer(packageJson) {
  const indexOfDash = packageJson.version.indexOf('-');
  if (indexOfDash > 0) {
    packageJson.version = packageJson.version.substring(0, indexOfDash);
  }
}