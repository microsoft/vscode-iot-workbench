import * as assert from "assert";
import * as vscode from "vscode";

import { AZ3166Device } from "../src/Models/AZ3166Device";
import { ComponentType } from "../src/Models/Interfaces/Component";
import { DeviceType } from "../src/Models/Interfaces/Device";
import { TelemetryContext, TelemetryWorker } from "../src/telemetry";

import { TestExtensionContext } from "./stub";

suite("IoT Device Workbench: Device", () => {
  // tslint:disable-next-line: only-arrow-functions
  test("property of device should be set correctly", function(done) {
    const context = new TestExtensionContext();
    const channel = vscode.window.createOutputChannel("IoT workbench test");
    const telemetryWorker = TelemetryWorker.getInstance(context);
    const telemetryContext: TelemetryContext = telemetryWorker.createContext();
    const device = new AZ3166Device(context, channel, telemetryContext, "", []);
    assert.equal(device.getDeviceType(), DeviceType.MXChipAZ3166);
    assert.equal(device.getComponentType(), ComponentType.Device);
    done();
  });
});
