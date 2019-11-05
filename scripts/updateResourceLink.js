const fs = require('fs');

if (process.env.TRAVIS_TAG) {
  const ISPROD = /^v?[0-9]+\.[0-9]+\.[0-9]+$/.test(process.env.TRAVIS_TAG || '');
  const packageJson = JSON.parse(fs.readFileSync('package.json'));
  if (ISPROD) {
    const codeGenUrl = "https://aka.ms/iot-codegen-cli-for-workbench";
    packageJson.codeGenConfigUrl = codeGenUrl;
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
  }
}