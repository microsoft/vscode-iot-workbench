/**
 * validate relative urls and external links in markdown files
 */
import * as validator from "validator";
import * as brokenLink from "broken-link";
import * as path from "path";
import * as fs from "fs";
import * as readline from "readline";

const exec = require("child_process").exec;
const args = require("yargs").argv;

/**
 * Interface for links
 */
interface Link {
  address: string;
  lineNumber: number;
}

interface FileReport {
  all: string[];
  errors: string[];
}

/**
 * Execute bash command
 */
function executeCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      }
      if (stderr) {
        reject(stderr);
      }
      resolve(stdout);
    });
  });
}

/**
 * Check whether the link is an URL with http / https protocol
 * @param linkToCheck link to check
 */
function isHttpLink(linkToCheck: string): boolean {
  // eslint-disable-next-line  @typescript-eslint/camelcase
  return validator.isURL(linkToCheck, { require_protocol: true, protocols: ["http", "https"] }) ? true : false;
}

/**
 * Validate external links and relative links given links of a file
 * @param file file contains links to check
 * @param links links to check
 */
function checkLinksCore(file: string, links: Link[]): Promise<FileReport> {
  return new Promise(resolve => {
    const fileReport: FileReport = { all: [], errors: [] };

    const iterateLinks = links.map(link => {
      return new Promise(async resolve => {
        let isBroken = false;
        if (isHttpLink(link.address)) {
          // Check external links
          isBroken = await brokenLink(link.address, { allowRedirects: true, match404Page: /404/ });
        } else {
          // Check markdown relative urls
          try {
            const currentWorkingDirectory = path.dirname(file);
            const splitPattern = path.sep + "#";
            const fullPath = path.resolve(currentWorkingDirectory, link.address).split(splitPattern)[0];
            isBroken = !fs.existsSync(fullPath);
          } catch (error) {
            // If there's an error, log the link
            console.log(`Error: ${link.address} on line ${link.lineNumber} is not an HTTP/s or relative link.`);
            isBroken = true;
          }
        }

        // Print log
        if (isBroken) {
          const message = `Error: [${file}] ${link.address} on line ${link.lineNumber} is unreachable.`;
          fileReport.errors.push(message);
          fileReport.all.push(message);
        } else {
          const message = `Info: [${file}] ${link.address} on line ${link.lineNumber}.`;
          fileReport.all.push(message);
        }
        resolve(fileReport);
      });
    });

    Promise.all(iterateLinks).then(() => {
      resolve(fileReport);
    });
  });
}

/**
 * Parse and get links in markdown file
 * @param file file to parse
 * @returns links info in the file
 */
function getLinks(file: string): Promise<Link[]> {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: fs.createReadStream(file)
    });

    const linksToReturn = new Array<Link>();
    let lineNumber = 0;

    // Parse each line to get links
    rl.on("line", line => {
      lineNumber++;
      // Parse markdown url syntax to get links
      const markdownUrlPattern = /\[[\s\S]*?\]\([\S]*?\)/g;
      const links = line.match(markdownUrlPattern);
      if (links) {
        for (let i = 0; i < links.length; i++) {
          const captureAddressPattern = /\[[\s\S]*?\]\(([\S]*?)\)/;
          const address = links[i].match(captureAddressPattern)[1];
          linksToReturn.push({
            address: address,
            lineNumber: lineNumber
          });
        }
      }
    });

    rl.on("close", () => {
      resolve(linksToReturn);
    });
  });
}

/**
 * Validate external urls and relative links in markdown file
 * @param file markdown file to check
 * @returns error links in the files
 */
async function checkLinks(file: string): Promise<string[]> {
  const links: Link[] = await getLinks(file);

  if (links.length > 0) {
    return new Promise(resolve => {
      checkLinksCore(file, links).then(fileReport => {
        console.log(`\n####### Checking file: ${file}`);

        // Print all links
        console.log(`> All links no: ${fileReport.all.length}`);
        if (fileReport.all.length > 0) {
          for (let i = 0; i < fileReport.all.length; i++) {
            console.log(fileReport.all[i]);
          }
        }

        // Print error links
        console.log(`> Error links no: ${fileReport.errors.length}`);
        if (fileReport.errors.length > 0) {
          for (let i = 0; i < fileReport.errors.length; i++) {
            console.log(fileReport.errors[i]);
          }
        }

        resolve(fileReport.errors);
      });
    });
  } else {
    return new Promise(resolve => {
      console.log(`\n###### Checking file: ${file}`);
      console.log(`No links found.`);

      resolve([]);
    });
  }
}

/**
 * Main entry for this checker script
 */
async function main(): Promise<void> {
  const rootDir = args.rootDir;
  const file = args.file;

  let files = [];
  let errorLinks: string[] = [];
  // Get markdown files needed to validate
  if (rootDir) {
    const command = `find ${rootDir}` + " -name '*.md' ! -path './node_modules/*' ! -path './out/*'";
    files = (await executeCommand(command)).trim().split("\n");
  } else if (file) {
    files[0] = file;
  }

  // Check links for each file
  for (let i = 0; i < files.length; i++) {
    const errorLinksInFile = await checkLinks(files[i]);
    errorLinks = errorLinks.concat(errorLinksInFile);
  }

  // Log out error message
  if (errorLinks.length > 0) {
    console.log("\n####### Issues :( ");
    console.log(`Error links in total: ${errorLinks.length}`);
    for (let i = 0; i < errorLinks.length; i++) {
      console.log(` ${i + 1}. ${errorLinks[i]}`);
    }

    // Exit on error since issues found
    process.exit(1);
  }

  console.log("############################ DONE ############################");
}

main();
