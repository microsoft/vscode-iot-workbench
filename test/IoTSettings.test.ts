// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from "path";
import { ConfigKey, OSPlatform } from "../src/constants";

const vscode = require("../__mocks__/vscode");
const { getHomeDir, getPlatform } = require("../src/utils");

jest.mock("../src/utils");
jest.mock("../src/configHandler");

let IoTWorkbenchSettingsModule: typeof import("../src/IoTSettings");
let configHandlerModule: typeof import("../src/configHandler");
const testHomeDir = "test-home-dir";

beforeEach(() => {
  // Set singleton modules as isolated module and they will be reseted every time
  jest.isolateModules(() => {
    IoTWorkbenchSettingsModule = require("../src/IoTSettings") as typeof import("../src/IoTSettings");
    configHandlerModule = require("../src/configHandler") as typeof import("../src/configHandler");
  });
});

describe("iot workbench settings", () => {
  getHomeDir.mockResolvedValue(testHomeDir);

  test("get default workbench path on linux", async () => {
    getPlatform.mockResolvedValueOnce(OSPlatform.LINUX);
    const defaultWorkbenchPath = await IoTWorkbenchSettingsModule.IoTWorkbenchSettings.getDefaultWorkbenchPath();
    expect(defaultWorkbenchPath).toEqual(path.join(testHomeDir, "IoTWorkbenchProjects"));
  });

  test("get default workbench path on Win", async () => {
    getPlatform.mockResolvedValueOnce(OSPlatform.WIN32);
    const defaultWorkbenchPath = await IoTWorkbenchSettingsModule.IoTWorkbenchSettings.getDefaultWorkbenchPath();
    expect(defaultWorkbenchPath).toEqual(path.join(testHomeDir, "Documents", "IoTWorkbenchProjects"));
  });

  test("get default workbench path on Mac", async () => {
    getPlatform.mockResolvedValueOnce(OSPlatform.DARWIN);
    const defaultWorkbenchPath = await IoTWorkbenchSettingsModule.IoTWorkbenchSettings.getDefaultWorkbenchPath();
    expect(defaultWorkbenchPath).toEqual(path.join(testHomeDir, "Documents", "IoTWorkbenchProjects"));
  });

  test("get instance will update workbench path config with path from the config if not empty", async () => {
    const workbenchPathFromConfig = "workbench-path-from-config";
    const defaultWorkbenchPath = "default-workbench-path";
    configHandlerModule.ConfigHandler.get = jest.fn().mockReturnValueOnce(workbenchPathFromConfig);
    IoTWorkbenchSettingsModule.IoTWorkbenchSettings.getDefaultWorkbenchPath = jest
      .fn()
      .mockResolvedValueOnce(defaultWorkbenchPath);

    await IoTWorkbenchSettingsModule.IoTWorkbenchSettings.getInstance();
    expect(configHandlerModule.ConfigHandler.update).toBeCalledWith(
      ConfigKey.workbench,
      workbenchPathFromConfig,
      vscode.ConfigurationTarget.Global
    );
  });

  test("get instance will update workbench path config with default workbench path if path form config is empty", async () => {
    const emptyString = "";
    const testWorkbenchPath = "test-workbench-path";
    configHandlerModule.ConfigHandler.get = jest.fn().mockReturnValueOnce(emptyString);
    IoTWorkbenchSettingsModule.IoTWorkbenchSettings.getDefaultWorkbenchPath = jest
      .fn()
      .mockResolvedValueOnce(testWorkbenchPath);

    await IoTWorkbenchSettingsModule.IoTWorkbenchSettings.getInstance();

    expect(configHandlerModule.ConfigHandler.update).toBeCalledWith(
      ConfigKey.workbench,
      testWorkbenchPath,
      vscode.ConfigurationTarget.Global
    );
  });

  test("set workbench path", async () => {
    const userWorkbenchPath = "user-workbench-path";
    vscode.window.showQuickPick = jest
      .fn()
      .mockResolvedValueOnce({ label: userWorkbenchPath, description: "", data: userWorkbenchPath });

    const settings = await IoTWorkbenchSettingsModule.IoTWorkbenchSettings.getInstance();
    await settings.setWorkbenchPath();

    expect(configHandlerModule.ConfigHandler.update).toBeCalledWith(
      ConfigKey.workbench,
      userWorkbenchPath,
      vscode.ConfigurationTarget.Global
    );
  });
});
