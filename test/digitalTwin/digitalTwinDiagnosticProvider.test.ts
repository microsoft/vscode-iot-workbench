// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { DigitalTwinDiagnosticProvider } from "../../src/DigitalTwin/pnp/src/intelliSense/digitalTwinDiagnosticProvider";
import { IntelliSenseUtility } from "../../src/DigitalTwin/pnp/src/intelliSense/intelliSenseUtility";
import { TestCase, TestUtility } from "../testUtility";
import { Diagnostic } from "vscode";

const vscode = require("../../__mocks__/vscode");

describe("DigitalTwin diagnostic provider", () => {
  const context = vscode.ExtensionContext;
  const document = vscode.TextDocument;
  const collection = vscode.DiagnosticCollection;
  const provider = new DigitalTwinDiagnosticProvider();

  let results: string[];
  collection.set = jest.fn((_uri, diagnostics: Diagnostic[]) => {
    results = diagnostics.map(e => e.message);
  });

  beforeAll(() => {
    return IntelliSenseUtility.initGraph(context);
  });

  test("invalid @context value", async () => {
    const testCase: TestCase = await TestUtility.readTestCase("invalid_context.json");
    document.getText = jest.fn().mockReturnValueOnce(testCase.input);
    provider.updateDiagnostics(document, collection);
    expect(collection.delete).toHaveBeenCalled();
  });

  test("invalid @type value", async () => {
    const testCase: TestCase = await TestUtility.readTestCase("invalid_type.json");
    document.getText = jest.fn().mockReturnValueOnce(testCase.input);
    provider.updateDiagnostics(document, collection);
    expect(results).toHaveLength(testCase.output.length);
    expect(results).toEqual(testCase.output);
  });

  test("Interface of DTDL v1", async () => {
    const testCase: TestCase = await TestUtility.readTestCase("interface_v1.json");
    document.getText = jest.fn().mockReturnValueOnce(testCase.input);
    provider.updateDiagnostics(document, collection);
    expect(results).toHaveLength(testCase.output.length);
    expect(results).toEqual(testCase.output);
  });
});
