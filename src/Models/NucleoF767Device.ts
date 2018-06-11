// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-plus';
import * as os from 'os';
import * as path from 'path';
import * as request from 'request-promise';
import * as cp from 'child_process';
import * as utils from '../utils';

import {error} from 'util';
import * as vscode from 'vscode';

import {ConfigHandler} from '../configHandler';
import {ConfigKey, FileNames} from '../constants';
import {MbedLibrary, ProjectTemplateType} from '../Models/Interfaces/ProjectTemplate';
import {IoTProject} from '../Models/IoTProject';

import {Component, ComponentType} from './Interfaces/Component';
import {Device, DeviceType} from './Interfaces/Device';

const constants = {
  MCU: 'NUCLEO_F767ZI',
  toochain: 'GCC_ARM'
};


export class NucleoF767Device implements Device {
  private deviceType: DeviceType;
  private componentType: ComponentType;
  private deviceFolder: string;
  private extensionContext: vscode.ExtensionContext;
  private projectType: string = '';
  private inputFiles: string[] = [];
  private profileFile: string|undefined;
  private channel: vscode.OutputChannel;
  private libraries: MbedLibrary[] = [];

  private static _boardId = 'nucleo767zi';

  static get boardId() {
    return NucleoF767Device._boardId;
  }

  constructor(
      context: vscode.ExtensionContext, channel: vscode.OutputChannel, devicePath: string, 
      projectType?:string, inputFiles?: string[], profileFile?: string, libraries?: MbedLibrary[]) {
      
      this.channel = channel;
      this.deviceType = DeviceType.IoT_Button;
      this.componentType = ComponentType.Device;
      this.deviceFolder = devicePath;
      this.extensionContext = context;
      if(projectType){
        this.projectType = projectType;
      } 
      if (inputFiles) {
        this.inputFiles = inputFiles;
      } 
      this.profileFile = profileFile;
      if(libraries){
        this.libraries = libraries;
      }

      // detect whether MBED is installed.
      utils.checkMbedExists().catch(
        ()=>{
          throw new Error('Mbed is not installed. You must install mbed first');
        }
      )
  }

  name = 'nucleo767zi';

  getDeviceType(): DeviceType {
    return this.deviceType;
  }

  getComponentType(): ComponentType {
    return this.componentType;
  }

  async load(): Promise<boolean> {
    const deviceFolderPath = this.deviceFolder;

    if (!fs.existsSync(deviceFolderPath)) {
      throw new Error('Unable to find the device folder inside the project.');
    }

    const profileFileName = await ConfigHandler.get<string>(ConfigKey.mbedProfile);
    if(profileFileName){
      this.profileFile = profileFileName;
    }

    return true;
  }

  async create(): Promise<boolean> {
    const deviceFolderPath = this.deviceFolder;

    if (!fs.existsSync(deviceFolderPath)) {
      throw new Error('Unable to find the device folder inside the project.');
    }

    try {
      const iotworkbenchprojectFilePath =
          path.join(deviceFolderPath, FileNames.iotworkbenchprojectFileName);
      fs.writeFileSync(iotworkbenchprojectFilePath, ' ');
    } catch (error) {
      throw new Error(
          `Device: create iotworkbenchproject file failed: ${error.message}`);
    }

    if(!this.projectType){
      throw new Error('Undefined project type.');
    }

    // Copy files defined in input files
    this.inputFiles.forEach(fileName =>{
      const filePath = this.extensionContext.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, NucleoF767Device._boardId, this.projectType,
        fileName));
      const targetFilePath = path.join(deviceFolderPath, fileName);
      fs.copyFileSync(filePath, targetFilePath);
    })

    const vscodeFolderPath =
        path.join(deviceFolderPath, FileNames.vscodeSettingsFolderName);
    if (!fs.existsSync(vscodeFolderPath)) {
      fs.mkdirSync(vscodeFolderPath);
    }

    // Create settings.json config file
    const settingsJSONFilePath =
        path.join(vscodeFolderPath, FileNames.settingsJsonFileName);
    const settingsJSONObj = {
      'files.exclude': {'.build': true, '.iotworkbenchproject': true}
    };

    try {
      fs.writeFileSync(
          settingsJSONFilePath, JSON.stringify(settingsJSONObj, null, 4));
    } catch (error) {
      throw new Error(`Device: create config file failed: ${error.message}`);
    }

    // copy profile file to the target
    if(this.profileFile){
      const filePath = this.extensionContext.asAbsolutePath(path.join(
        FileNames.resourcesFolderName, NucleoF767Device._boardId, this.projectType,
        this.profileFile));
      const targetFilePath = path.join(vscodeFolderPath, this.profileFile);
      fs.copyFileSync(filePath, targetFilePath);  
      
      await ConfigHandler.update(
        ConfigKey.mbedProfile, this.profileFile);
    }

    // Invoke mbed new . from device folder
    this.channel.show();
    this.channel.appendLine('Start loading mbed core and libraries.');

    const command = 'mbed new .';
    const intervalID = setInterval(() => {
      this.channel.append(".");
    }, 1000);
    await utils.runCommand(command, deviceFolderPath, this.channel);
    clearInterval(intervalID);

    //load libraries
    if(this.libraries && this.libraries.length > 0){
      this.libraries.forEach(async(library) => {
        this.channel.appendLine(`Loading mbed libraries ${library.name}.`); 
        const command = `mbed add ${library.url} ${library.name}`;
        await utils.runCommand(command, deviceFolderPath, this.channel);
      })
    }

    return true;
  }

  async compile(): Promise<boolean> {
    try{
      await utils.checkMbedExists();
    }
    catch{
      throw new Error('Unable to detect the mbed.'); 
    }

    var command = `mbed compile -m ${constants.MCU} -t ${constants.toochain}`;
    if(this.profileFile){
      const profilePath = path.join(this.deviceFolder, 
        FileNames.vscodeSettingsFolderName, this.profileFile);
      command += ` --profile ${profilePath}`;
    }
    this.channel.show();
    this.channel.appendLine('Start compiling:');
    await utils.runCommand(command, this.deviceFolder, this.channel);

    return true;
  }

  async upload(): Promise<boolean> {
    return true;
  }

  async configDeviceSettings(): Promise<boolean> {
    return false;
  }
}