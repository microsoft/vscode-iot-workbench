const fs = require('fs');

const codeGenUrl = process.env['prodCodeGenUrl-v2'];
const graphUrl = process.env['prodGraphUrl'];
const interfaceUrl = process.env['prodInterfaceUrl'];
const capabilityModelUrl = process.env['prodCapabilityModelUrl'];

if(!codeGenUrl){
  throw new Error('Unable to find the variable of prodCodeGenUrl-v2');
}
if(!graphUrl){
  throw new Error('Unable to find the variable of prodGraphUrl');
}
if(!interfaceUrl){
  throw new Error('Unable to find the variable of prodInterfaceUrl');
}
if(!capabilityModelUrl){
  throw new Error('Unable to find the variable of prodCapabilityModelUrl');
}

const packageJson = JSON.parse(fs.readFileSync('package.json'));
const ISPROD = /^v?[0-9]+\.[0-9]+\.[0-9]+$/.test(packageJson.version);
  
if (ISPROD) {
  packageJson.codeGenConfigUrl = codeGenUrl;
  packageJson.graphUrl = graphUrl;
  packageJson.interfaceUrl = interfaceUrl;
  packageJson.capabilityModelUrl = capabilityModelUrl;
  fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
}
