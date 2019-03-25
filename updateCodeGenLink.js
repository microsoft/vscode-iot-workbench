const fs = require('fs');

const codeGenUrl = process.env['prodCodeGenUrl-v2'];
if(!codeGenUrl){
  throw new Error('Unable to find the variable of prodCodeGenUrl-v2');
}

const packageJson = JSON.parse(fs.readFileSync('package.json'));
const ISPROD = /^v?[0-9]+\.[0-9]+\.[0-9]+$/.test(packageJson.version);
  
if (ISPROD) {
  packageJson.codeGenConfigUrl = codeGenUrl;
  fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
}
