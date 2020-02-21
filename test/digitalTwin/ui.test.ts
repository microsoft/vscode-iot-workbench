// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { UI } from "../../src/DigitalTwin/pnp/src/view/ui";
import { UIConstants } from "../../src/DigitalTwin/pnp/src/view/uiConstants";
import { Constants } from "../../src/DigitalTwin/pnp/src/common/constants";

const vscode = require("../../__mocks__/vscode");

describe("UI", () => {
  const label = "label";
  const browseQuickPickItem = {
    label: UIConstants.BROWSE_LABEL,
    description: Constants.EMPTY_STRING
  };
  const quickPickOptions = {
    placeHolder: label,
    ignoreFocusOut: true
  };
  const openDialogOptions = {
    openLabel: label,
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false
  };
  const browseUri = {
    fsPath: "browse"
  };

  afterEach(() => {
    vscode.workspace.workspaceFolders = undefined;
  });

  test("select root folder when only one folder is opened", async () => {
    vscode.workspace.workspaceFolders = [vscode.WorkspaceFolder];
    const folder: string = await UI.selectRootFolder(label);
    expect(folder).toBe("path");
  });

  test("select root folder when no folder is opened", async () => {
    vscode.window.showOpenDialog = jest.fn().mockResolvedValueOnce([browseUri]);
    const folder: string = await UI.selectRootFolder(label);
    expect(vscode.window.showQuickPick).toHaveBeenCalledWith([browseQuickPickItem], quickPickOptions);
    expect(vscode.window.showOpenDialog).toHaveBeenCalledWith(openDialogOptions);
    expect(folder).toBe("browse");
  });
});
