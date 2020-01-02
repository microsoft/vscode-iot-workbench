const fs = require('fs');

/**
 * If Nightly Build or Production release or RC release, modify package.json and related template files.
 * If common PR, do no modification.
 * TRAVIS_EVENT_TYPE === "cron" :                       Nightly Build
 * TRAVIS_TAG =~ /^v?[0-9]+\.[0-9]+\.[0-9]+$/:          Production release (eg. v0.10.18)
 * TRAVIS_TAG =~ /^v?[0-9]+\.[0-9]+\.[0-9]+-[rR][cC]/:  RC release (eg. v0.10.18-rc, v0.10.18-rc2, etc.)
 */
if (process.env.TRAVIS_EVENT_TYPE === "cron" || process.env.TRAVIS_TAG) {
  const packageJson = JSON.parse(fs.readFileSync('package.json'));

  // Nightly Build
  if (process.env.TRAVIS_EVENT_TYPE === "cron") {
    const nightlyBuildName = "test-owl-project-nightly";
    const nightlyBuildDisplayName = "Test OWL Project (Nightly)";
    const nightlyBuildPublisher = "IoTDevExBuild";
    modifyPackageJsonForNonProduction(packageJson, nightlyBuildName, nightlyBuildDisplayName, nightlyBuildPublisher);
  } else if (process.env.TRAVIS_TAG) {
    const isProduction = /^v?[0-9]+\.[0-9]+\.[0-9]+$/.test(process.env.TRAVIS_TAG || '');
    const isTestVersion = /^v?[0-9]+\.[0-9]+\.[0-9]+-[rR][cC]/.test(process.env.TRAVIS_TAG || '');

    if (isProduction) {
      // Update resource link
      const codeGenUrl = "https://aka.ms/iot-codegen-cli-for-workbench";
      packageJson.codeGenConfigUrl = codeGenUrl;

      // Update production AI Key
      packageJson.aiKey = process.env['PROD_AIKEY'];
    } else if (isTestVersion) {
      const testName = "test-owl-project";
      const testDisplayName = "Test OWL Project RC";
      const testPublisher = "IoTDevExBuild";
      modifyPackageJsonForNonProduction(packageJson, testName, testDisplayName, testPublisher);

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
 * Update package.json with test name, displayName, publisher, ai aky.
 * Trim version number. Delete extension icon.
 * @param {*} packageJson package json oject
 * @param {*} testName test extension name
 * @param {*} testDisplayName test extension displate name
 * @param {*} testPublisher test publisher
 */
function modifyPackageJsonForNonProduction(packageJson, testName, testDisplayName, testPublisher) {
  packageJson.name = testName;
  packageJson.displayName = testDisplayName;
  packageJson.publisher = testPublisher;

  packageJson.aiKey = process.env['TEST_AIKEY'];

  const indexOfDash = packageJson.version.indexOf('-');
  if (indexOfDash > 0) {
    packageJson.version = packageJson.version.substring(0, indexOfDash);
  }

  delete packageJson.icon;
}