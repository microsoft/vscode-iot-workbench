// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from "path";
import { Utility } from "../src/DigitalTwin/pnp/src/common/utility";

export interface TestCase {
  input: string;
  output: string[];
}

export class TestUtility {
  private static readonly TEST_CASE_FOLDER = "test/resources";

  static async readTestCase(fileName: string): Promise<TestCase> {
    const filePath: string = path.join(TestUtility.TEST_CASE_FOLDER, fileName);
    const content = await Utility.getJsonContent(filePath);
    const input: string = JSON.stringify(content["input"]);
    const output = content["output"] as string[];
    return { input, output };
  }

  private constructor() {}
}
