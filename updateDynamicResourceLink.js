const fs = require("fs");

const codeGenUrl = process.env["prodCodeGenUrl-v2"];
const graphUrl = process.env["graphUrl"];
const interfaceUrl = process.env["interfaceUrl"];
const capabilityModelUrl = process.env["capabilityModelUrl"];

if (!codeGenUrl) {
  throw new Error("Unable to find the variable of prodCodeGenUrl-v2");
}
if (!graphUrl) {
  throw new Error("Unable to find the variable of graphUrl");
}
if (!interfaceUrl) {
  throw new Error("Unable to find the variable of interfaceUrl");
}
if (!capabilityModelUrl) {
  throw new Error("Unable to find the variable of capabilityModelUrl");
}

const packageJson = JSON.parse(fs.readFileSync("package.json"));
const ISPROD = /^v?[0-9]+\.[0-9]+\.[0-9]+$/.test(packageJson.version);

if (ISPROD) {
  packageJson.codeGenConfigUrl = codeGenUrl;
  packageJson.graphUrl = graphUrl;
  packageJson.interfaceUrl = interfaceUrl;
  packageJson.capabilityModelUrl = capabilityModelUrl;
  fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2) + "\n");
}
