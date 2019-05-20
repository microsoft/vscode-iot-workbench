'use strict';

import * as fs from 'fs-plus';
import * as path from 'path';
import * as vscode from 'vscode';
import {FileNames} from '../constants';

export class ScaffoldGenerator {

  /**
   * Generate common files: 1. iot workbench project file; 2. .vscode folder; 3. .devcontainer folder
   * @param projectFolder 
   * @param vscodeFolderPath 
   * @param devcontainerFolderPath 
   */
  static async generateCommonFiles(projectFolder: string, vscodeFolderPath: string, devcontainerFolderPath: string): Promise<boolean> {
    if (!fs.existsSync(projectFolder)) {
      throw new Error('Unable to find the project folder.');
    }

    try {
      const iotworkbenchprojectFilePath =
          path.join(projectFolder, FileNames.iotworkbenchprojectFileName);
      fs.writeFileSync(iotworkbenchprojectFilePath, ' ');
    } catch (error) {
      throw new Error(
          `Create ${FileNames.iotworkbenchprojectFileName} file failed: ${error.message}`);
    }

    if (!fs.existsSync(vscodeFolderPath)) {
      try {
        fs.mkdirSync(vscodeFolderPath);
      } catch (error) {
        throw new Error(`Failed to create folder ${vscodeFolderPath}. Error message: ${error.message}`);
      }
    }

    if (!fs.existsSync(devcontainerFolderPath)) {
      try {
        fs.mkdirSync(devcontainerFolderPath);
      } catch (error) {
        throw new Error(`Failed to create folder ${devcontainerFolderPath}. Error message: ${error.message}`);
      }
    }

    return true;
  }

  /**
   * Create c_cpp_properties.json file
   */
  static async generateCppPropertiesFile(vscodeFolderPath: string, boardFolderPath: string, boardId: string): Promise<boolean> { 
    const cppPropertiesFilePath =
        path.join(vscodeFolderPath, FileNames.cppPropertiesFileName);

    if (fs.existsSync(cppPropertiesFilePath)) {
      return true;
    }

    try {
      const propertiesSourceFile = path.join(
        boardFolderPath, boardId, FileNames.cppPropertiesFileName);
      const propertiesContent =
          fs.readFileSync(propertiesSourceFile).toString();
      fs.writeFileSync(cppPropertiesFilePath, propertiesContent);
    } catch (error) {
      throw new Error(`Create ${FileNames.cppPropertiesFileName} failed: ${error.message}`);
    }

    return true;
  }

  /**
   * Create Dockerfile & devcontainer.json
   */
  static async generateDockerRelatedFiles(devcontainerFolderPath: string, boardFolderPath: string, boardId: string): Promise<boolean> {
    // Dockerfile
    const dockerfileTargetPath = path.join(
      devcontainerFolderPath, FileNames.dockerfileName);

    if (fs.existsSync(dockerfileTargetPath)) {
      return true;
    }

    try {
      const dockerfileSourcePath = path.join(
        boardFolderPath, boardId, FileNames.dockerfileName);
      const dockerfileContent = fs.readFileSync(dockerfileSourcePath, 'utf8');
      fs.writeFileSync(dockerfileTargetPath, dockerfileContent);
    } catch (error) {
      throw new Error(`Create ${FileNames.dockerfileName} failed: ${error.message}`);
    }

    // devcontainer.json
    const devcontainerJsonFileTargetPath = path.join(
      devcontainerFolderPath, FileNames.devcontainerJsonFileName);

    if (fs.existsSync(devcontainerJsonFileTargetPath)) {
      return true;
    }

    try {
      const devcontainerJsonFileSourcePath = path.join(
        boardFolderPath, boardId, FileNames.devcontainerJsonFileName);
      const devcontainerJSONContent = fs.readFileSync(devcontainerJsonFileSourcePath, 'utf8');
      fs.writeFileSync(devcontainerJsonFileTargetPath, devcontainerJSONContent);
    } catch (error) {
      throw new Error(`Create ${FileNames.devcontainerJsonFileName} file failed: ${error.message}`);
    }

    return true;
  }

  /**
   * Create Dockerfile & devcontainer.json
   */
  static async scaffolIoTProjectdFiles(projectFolder: string, vscodeFolderPath: string, boardFolderPath: string, devcontainerFolderPath: string, boardId: string) {
    try {
      await ScaffoldGenerator.generateCommonFiles(projectFolder, vscodeFolderPath, devcontainerFolderPath);
      await ScaffoldGenerator.generateCppPropertiesFile(vscodeFolderPath, boardFolderPath, boardId);
      await ScaffoldGenerator.generateDockerRelatedFiles(devcontainerFolderPath, boardFolderPath, boardId);
    } catch (error) {
      throw new Error(`Scaffold files for IoT Project failed. ${error.message}`);
    }
  }
}