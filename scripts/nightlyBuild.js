const fs = require('fs');

if (process.env.TRAVIS_EVENT_TYPE === "cron") {
    const packageJson = JSON.parse(fs.readFileSync('package.json'));

    const nightlyBuildName = "vscode-iot-workbench-nightly";
    const nightlyBuildDisplayName = "Azure IoT Device Workbench (Nightly)";
    packageJson.name = nightlyBuildName;
    packageJson.displayName = nightlyBuildDisplayName;
    packageJson.aiKey = process.env['TEST_AIKEY'];

    const indexOfDash = packageJson.version.indexOf('-');
    if (indexOfDash > 0) {
      packageJson.version = packageJson.version.substring(0, indexOfDash);
    }

    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
}
