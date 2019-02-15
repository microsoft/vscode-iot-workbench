// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

export class DockerManager {
  constructCommandForBuildConfig(
      projectName: string, outputFolder: string, imagePath: string,
      rootPath: string): string {
    const commands: string[] = [];
    commands.push(this.constructDockerBuildCmd(imagePath, rootPath));
    commands.push(`echo "Information: build image with application completed"`);
    commands.push(this.constructDockerCreateCommand(imagePath));
    const targetPath = path.join(rootPath, outputFolder);
    commands.push(this.constructDockerCopyAppCommand(projectName, targetPath));
    commands.push(
        `echo "Information: the application is copied into local folder."`);
    return this.combineCommands(commands);
  }

  constructGetVersionCmd(): string {
    return 'docker --version';
  }

  private constructDockerBuildCmd(imagePath: string, path: string): string {
    return `docker build -t ${imagePath} ${path} --network=host`;
  }

  private constructDockerCreateCommand(imagePath: string): string {
    if (os.platform() === 'win32') {
      return `$cid = (docker create ${imagePath})`;
    } else {
      return `cid=$(docker create ${imagePath})`;
    }
  }

  private constructDockerCopyAppCommand(source: string, target: string):
      string {
    if (os.platform() === 'win32') {
      return `docker cp \${cid}:/work/AzureBuild/${source}/cmake/ ${target}`;
    } else {
      return `docker cp $CID:/work/AzureBuild/${source}/cmake/ ${target}`;
    }
  }


  private combineCommands(commands: string[]): string {
    let isPowerShell = false;
    if (os.platform() === 'win32') {
      const windowsShell = vscode.workspace.getConfiguration('terminal')
                               .get<string>('integrated.shell.windows');
      if (windowsShell &&
          windowsShell.toLowerCase().indexOf('powershell') > -1) {
        isPowerShell = true;
      }
    }
    if (isPowerShell) {
      let command = '';
      for (let i = 0; i < commands.length; i++) {
        switch (i) {
          case 0:
            command = commands[0];
            break;
          case 1:
            command = `${command} ; if ($?) { ${commands[1]}`;
            break;
          default:
            command = `${command} } if ($?) { ${commands[i]}`;
        }
      }
      if (commands.length > 1) {
        command += ' }';
      }
      return command;
    } else {
      return commands.join(' && ');
    }
  }
}