// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

export interface DockerBuildConfig {
  imageName: string;
  imageVersion: string;
  volumeName: string;
  source: string;
  output: string;
}

export class DockerManager {
  constructCommandForBuildConfig(
      buildConfig: DockerBuildConfig, rootPath: string): string {
    const commands: string[] = [];
    commands.push(this.constructDockerBuildCmd(
        buildConfig.imageName, buildConfig.imageVersion, rootPath));
    commands.push(this.constructCreateVolumeCmd(buildConfig.volumeName));
    commands.push(this.constructRunAppCommand(buildConfig.volumeName));
    commands.push(this.constructDockerCreateCommand(
        buildConfig.imageName, buildConfig.imageVersion));
    const targetPath = path.join(rootPath, buildConfig.output);
    commands.push(
        this.constructDockerCopyAppCommand(buildConfig.source, targetPath));
    return this.combineCommands(commands);
  }

  constructGetVersionCmd(): string {
    return 'docker --version';
  }

  private constructDockerBuildCmd(
      imageName: string, imageVersion: string, path: string): string {
    return `docker build -t ${imageName}:${imageVersion} ${
        path} --network=host`;
  }

  private constructCreateVolumeCmd(volumeName: string): string {
    return `docker volume create --name ${volumeName}`;
  }

  private constructRunAppCommand(volumeName: string): string {
    return `docker run -it --rm -v ${
        volumeName}:/workdir busybox chown -R 1000:1000 /workdir`;
  }

  private constructDockerCreateCommand(imageName: string, imageVersion: string):
      string {
    if (os.platform() === 'win32') {
      return `$cid = (docker create ${imageName}:${imageVersion})`;
    } else {
      return `cid=$(docker create ${imageName}:${imageVersion})`;
    }
  }

  private constructDockerCopyAppCommand(source: string, target: string):
      string {
    if (os.platform() === 'win32') {
      return `docker cp \${cid}:/workdir/AzureBuild/${source}/cmake/ ${target}`;
    } else {
      return `docker cp $CID:/workdir/AzureBuild/${source}/cmake/ ${target}`;
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