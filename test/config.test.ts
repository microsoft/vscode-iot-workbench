import * as assert from "assert";

import { ConfigHandler } from "../src/configHandler";
import { ConfigKey } from "../src/constants";

suite("IoT Device Workbench: Config", () => {
  test("should set and get config value correctly", async function() {
    this.timeout(60 * 1000);
    assert.equal(ConfigHandler.get<string>(ConfigKey.boardId), "devkit");
    assert.equal(ConfigHandler.get<string>(ConfigKey.devicePath), "Device");
    await ConfigHandler.update(ConfigKey.boardId, "IoTButton");
    assert.equal(ConfigHandler.get<string>(ConfigKey.boardId), "IoTButton");
    await ConfigHandler.update(ConfigKey.boardId, "devkit");
    assert.equal(ConfigHandler.get<string>(ConfigKey.boardId), "devkit");
  });
});
