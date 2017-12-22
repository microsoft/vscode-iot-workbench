'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs-plus';
import * as path from 'path';
import {ExceptionHelper} from './exceptionHelper';
import {IoTProject, ProjectTemplateType} from './Models/IoTProject';

export class DeviceSecureWriter {
    async SetIoTHubDeviceConnection(context: vscode.ExtensionContext) {
        // Retrieve the IoT Hub device connection string from the runtime file from provision task

        // Set the connection to EEPROM for secure access
    }
}
