'use strict';

import * as fs from 'fs-plus';
import * as path from 'path';
import {FileNames} from '../constants';
import {FileUtility} from '../FileUtility';

export class ScaffoldGenerator {
  private exists:((localPath: string) => Promise<boolean>) | undefined;
  private writeFile: ((filePath: string, data: string | Buffer) => Promise<void>) | undefined;
  private mkdirRecursively: ((dirPath: string) => Promise<void>) | undefined;

  // Generate files in local from remote side
  private async generateCommonFiles(projectFolder: string, vscodeFolderPath: string, devcontainerFolderPath: string): Promise<boolean> {
    if (this.exists === undefined || this.writeFile === undefined || this.mkdirRecursively === undefined) {
      throw new Error(`File-related function is not correctly set.`);
    }

    if (!await this.exists(projectFolder)) {
      throw new Error('Unable to find the project folder.');
    }

    try {
      const iotworkbenchprojectFilePath =
          path.join(projectFolder, FileNames.iotworkbenchprojectFileName);
      await this.writeFile(iotworkbenchprojectFilePath, ' ');
    } catch (error) {
      throw new Error(
          `Create ${FileNames.iotworkbenchprojectFileName} file failed: ${error.message}`);
    }

    if (!await this.exists(vscodeFolderPath)) {
      try {
        await this.mkdirRecursively(vscodeFolderPath);
      } catch (error) {
        throw new Error(`Failed to create folder ${vscodeFolderPath}. Error message: ${error.message}`);
      }
    }

    if (! await this.exists(devcontainerFolderPath)) {
      try {
        await this.mkdirRecursively(devcontainerFolderPath);
      } catch (error) {
        throw new Error(`Failed to create folder ${devcontainerFolderPath}. Error message: ${error.message}`);
      }
    }

    return true;
  }
  
  /**
   * Create c_cpp_properties.json file
   */
  private async generateCppPropertiesFile(vscodeFolderPath: string, boardFolderPath: string, boardId: string): Promise<boolean> {
    if (this.exists === undefined || this.writeFile === undefined || this.mkdirRecursively === undefined) {
      throw new Error(`File-related function is not correctly set.`);
    }

    const cppPropertiesFilePath =
        path.join(vscodeFolderPath, FileNames.cppPropertiesFileName);

    if (await this.exists(cppPropertiesFilePath)) {
      return true;
    }

    try {
      const propertiesSourceFile = path.join(
        boardFolderPath, boardId, FileNames.cppPropertiesFileName);
      const propertiesContent =
          fs.readFileSync(propertiesSourceFile).toString();
      if (!await this.exists(vscodeFolderPath)) {
        await this.mkdirRecursively(vscodeFolderPath);
      }
      await this.writeFile(cppPropertiesFilePath, propertiesContent);
    } catch (error) {
      throw new Error(`Create ${FileNames.cppPropertiesFileName} failed: ${error.message}`);
    }

    return true;
  }

  /**
   * Create Dockerfile & devcontainer.json
   */
  private async generateDockerRelatedFiles(devcontainerFolderPath: string, boardFolderPath: string, boardId: string): Promise<boolean> {
    if (this.exists === undefined || this.writeFile === undefined || this.mkdirRecursively === undefined) {
      throw new Error(`File-related function is not correctly set.`);
    }

    // Dockerfile
    const dockerfileTargetPath = path.join(
      devcontainerFolderPath, FileNames.dockerfileName);
    if (!await this.exists(devcontainerFolderPath)) {
      await this.mkdirRecursively(devcontainerFolderPath);
    }

    if (await this.exists(dockerfileTargetPath)) {
      return true;
    }

    try {
      const dockerfileSourcePath = path.join(
        boardFolderPath, boardId, FileNames.dockerfileName);
      const dockerfileContent = fs.readFileSync(dockerfileSourcePath, 'utf8');
      await this.writeFile(dockerfileTargetPath, dockerfileContent);
    } catch (error) {
      throw new Error(`Create ${FileNames.dockerfileName} failed: ${error.message}`);
    }

    // devcontainer.json
    const devcontainerJsonFileTargetPath = path.join(
      devcontainerFolderPath, FileNames.devcontainerJsonFileName);

    if (await this.exists(devcontainerJsonFileTargetPath)) {
      return true;
    }

    try {
      const devcontainerJsonFileSourcePath = path.join(
        boardFolderPath, boardId, FileNames.devcontainerJsonFileName);
      const devcontainerJSONContent = fs.readFileSync(devcontainerJsonFileSourcePath, 'utf8');
      await this.writeFile(devcontainerJsonFileTargetPath, devcontainerJSONContent);
    } catch (error) {
      throw new Error(`Create ${FileNames.devcontainerJsonFileName} file failed: ${error.message}`);
    }

    return true;
  }

  // Scaffold common iot project files to the current workspace path
  async scaffolIoTProjectdFilesInWorkspace(projectFolder: string, vscodeFolderPath: string, boardFolderPath: string, devcontainerFolderPath: string, boardId: string) {
    try {
      this.exists = FileUtility.existsInWorkspace;
      this.writeFile = FileUtility.writeFileInWorkspace;
      this.mkdirRecursively = FileUtility.mkdirRecursivelyInWorkspace;
      await this.generateCommonFiles(projectFolder, vscodeFolderPath, devcontainerFolderPath);
      await this.generateCppPropertiesFile(vscodeFolderPath, boardFolderPath, boardId);
      await this.generateDockerRelatedFiles(devcontainerFolderPath, boardFolderPath, boardId);
    } catch (error) {
      throw new Error(`Scaffold files for IoT Project failed. ${error.message}`);
    }
  }

  // Used when creating a new iot project.
  // Scaffold common iot project files to a certain local path
  async scaffolIoTProjectdFilesInLocal(projectFolder: string, vscodeFolderPath: string, boardFolderPath: string, devcontainerFolderPath: string, boardId: string) {
    try {
      this.exists = FileUtility.existsInLocal;
      this.writeFile = FileUtility.writeFileInLocal;
      this.mkdirRecursively = FileUtility.mkdirRecursivelyInLocal;
      await this.generateCommonFiles(projectFolder, vscodeFolderPath, devcontainerFolderPath);
      await this.generateCppPropertiesFile(vscodeFolderPath, boardFolderPath, boardId);
      await this.generateDockerRelatedFiles(devcontainerFolderPath, boardFolderPath, boardId);
    } catch (error) {
      throw new Error(`Scaffold files for IoT Project failed. ${error.message}`);
    }
  }
}