// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from "path";
import { ConfigKey, OSPlatform } from "../src/constants";
import { ConfigHandler } from "../src/configHandler";

const vscode = require("../__mocks__/vscode");
const { getHomeDir, getPlatform } = require("../src/utils");

jest.mock("../src/utils");
jest.mock("../src/configHandler");

describe("iot workbench settings", () => {
  let IoTWorkbenchSettingsModule: typeof import("../src/IoTSettings");
  const testHomeDir = "test-home-dir";
  const emptyString = "";
  const testWorkbenchPath = "test-workbench-path";
  getHomeDir.mockResolvedValue(testHomeDir);
  getPlatform.mockResolvedValue(OSPlatform.LINUX);
  const expectedDefaultWorkbenchPathOnLinux = path.join(testHomeDir, "IoTWorkbenchProjects");

  beforeEach(() => {
    // Set singleton modules as isolated module and they will be reseted every time
    jest.isolateModules(() => {
      IoTWorkbenchSettingsModule = require("../src/IoTSettings");
    });
  });

  test("get default workbench path on linux", async () => {
    const defaultWorkbenchPath = await IoTWorkbenchSettingsModule.IoTWorkbenchSettings.getDefaultWorkbenchPath();
    expect(defaultWorkbenchPath).toBe(expectedDefaultWorkbenchPathOnLinux);
  });

  test("get default workbench path on Win", async () => {
    getPlatform.mockResolvedValueOnce(OSPlatform.WIN32);
    const defaultWorkbenchPath = await IoTWorkbenchSettingsModule.IoTWorkbenchSettings.getDefaultWorkbenchPath();
    expect(defaultWorkbenchPath).toBe(path.join(testHomeDir, "Documents", "IoTWorkbenchProjects"));
  });

  test("get default workbench path on Mac", async () => {
    getPlatform.mockResolvedValueOnce(OSPlatform.DARWIN);
    const defaultWorkbenchPath = await IoTWorkbenchSettingsModule.IoTWorkbenchSettings.getDefaultWorkbenchPath();
    expect(defaultWorkbenchPath).toBe(path.join(testHomeDir, "Documents", "IoTWorkbenchProjects"));
  });

  test("get instance will update workbench path config with path from the config if not empty", async () => {
    ConfigHandler.get = jest.fn().mockReturnValueOnce(testWorkbenchPath);

    await IoTWorkbenchSettingsModule.IoTWorkbenchSettings.getInstance();

    expect(ConfigHandler.update).toHaveBeenCalledWith(
      ConfigKey.workbench,
      testWorkbenchPath,
      vscode.ConfigurationTarget.Global
    );
  });

  test("get instance will update workbench path config with default workbench path if path from config is empty", async () => {
    ConfigHandler.get = jest.fn().mockReturnValueOnce(emptyString);

    await IoTWorkbenchSettingsModule.IoTWorkbenchSettings.getInstance();

    expect(ConfigHandler.update).toHaveBeenCalledWith(
      ConfigKey.workbench,
      expectedDefaultWorkbenchPathOnLinux,
      vscode.ConfigurationTarget.Global
    );
  });

  test("set workbench path with user workbench path", async () => {
    ConfigHandler.get = jest.fn().mockReturnValueOnce(testWorkbenchPath);

    const settings = await IoTWorkbenchSettingsModule.IoTWorkbenchSettings.getInstance();
    await settings.setWorkbenchPath();

    expect(ConfigHandler.update).toHaveBeenCalledWith(
      ConfigKey.workbench,
      testWorkbenchPath,
      vscode.ConfigurationTarget.Global
    );
  });

  test("get workbench path from workspace config", async () => {
    ConfigHandler.get = jest.fn().mockReturnValueOnce(testWorkbenchPath);

    const settings = await IoTWorkbenchSettingsModule.IoTWorkbenchSettings.getInstance();
    const newWorkbenchPath = await settings.getWorkbenchPath();

    expect(newWorkbenchPath).toBe(testWorkbenchPath);
  });

  test("get workbench path when workspace config is empty", async () => {
    ConfigHandler.get = jest.fn().mockReturnValueOnce(emptyString);

    const settings = await IoTWorkbenchSettingsModule.IoTWorkbenchSettings.getInstance();
    const newWorkbenchPath = await settings.getWorkbenchPath();

    expect(newWorkbenchPath).toBe(expectedDefaultWorkbenchPathOnLinux);
  });
});
