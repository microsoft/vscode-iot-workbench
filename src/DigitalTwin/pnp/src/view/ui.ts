// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from "path";
import * as vscode from "vscode";
import { Constants } from "../common/constants";
import { UserCancelledError } from "../common/userCancelledError";
import { Utility } from "../common/utility";
import { ModelType } from "../deviceModel/deviceModelManager";
import { ModelFileInfo } from "../modelRepository/modelRepositoryManager";
import { UIConstants } from "./uiConstants";

/**
 * Message type
 */
export enum MessageType {
  Info,
  Warn,
  Error,
}

/**
 * Choice type
 */
export enum ChoiceType {
  All = "All",
  Yes = "Yes",
  No = "No",
  Cancel = "Cancel",
}

/**
 * Quick pick item with custom data
 */
interface QuickPickItemWithData<T> extends vscode.QuickPickItem {
  data: T;
}

/**
 * Utility for UI
 */
export class UI {
  /**
   * open and show text document
   * @param filePath file path
   */
  static async openAndShowTextDocument(filePath: string): Promise<void> {
    const folder: string = path.dirname(filePath);
    await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(folder), false);
    await vscode.window.showTextDocument(vscode.Uri.file(filePath));
  }

  /**
   * show notification in non-blocking way
   * @param type message type
   * @param message message
   */
  static showNotification(type: MessageType, message: string): void {
    switch (type) {
    case MessageType.Info:
      vscode.window.showInformationMessage(message);
      break;
    case MessageType.Warn:
      vscode.window.showWarningMessage(message);
      break;
    case MessageType.Error:
      vscode.window.showErrorMessage(message);
      break;
    default:
    }
  }

  /**
   * select root folder
   * @param label label
   */
  static async selectRootFolder(label: string): Promise<string> {
    const workspaceFolders: vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
    // use the only workspace as default
    if (workspaceFolders && workspaceFolders.length === 1) {
      return workspaceFolders[0].uri.fsPath;
    }
    // select workspace or open specified folder
    let items: vscode.QuickPickItem[] = [];
    if (workspaceFolders) {
      items = workspaceFolders.map((f: vscode.WorkspaceFolder) => {
        const fsPath: string = f.uri.fsPath;
        return {
          label: path.basename(fsPath),
          description: fsPath,
        };
      });
    }
    items.push({ label: UIConstants.BROWSE_LABEL, description: Constants.EMPTY_STRING });
    const selected: vscode.QuickPickItem = await UI.showQuickPick(label, items);
    return selected.description || (await UI.showOpenDialog(label));
  }

  /**
   * show quick pick items
   * @param label label
   * @param items quick pick item list
   */
  static async showQuickPick(label: string, items: vscode.QuickPickItem[]): Promise<vscode.QuickPickItem> {
    const options: vscode.QuickPickOptions = {
      placeHolder: label,
      ignoreFocusOut: true,
    };
    const selected: vscode.QuickPickItem | undefined = await vscode.window.showQuickPick(items, options);
    if (!selected) {
      throw new UserCancelledError(label);
    }
    return selected;
  }

  /**
   * show open dialog
   * @param label label
   * @param defaultUri default uri
   */
  static async showOpenDialog(label: string, defaultUri?: vscode.Uri): Promise<string> {
    const options: vscode.OpenDialogOptions = {
      openLabel: label,
      defaultUri,
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
    };
    const selected: vscode.Uri[] | undefined = await vscode.window.showOpenDialog(options);
    if (!selected || selected.length === 0) {
      throw new UserCancelledError(label);
    }
    return selected[0].fsPath;
  }

  /**
   * input model name and validate
   * @param label label
   * @param type model type
   * @param folder target folder
   */
  static async inputModelName(label: string, type: ModelType, folder: string): Promise<string> {
    const placeHolder = `${type} name`;
    const validateInput = async (name: string): Promise<string|undefined> => {
      return await Utility.validateModelName(name, type, folder);
    };
    return await UI.showInputBox(label, placeHolder, validateInput);
  }

  /**
   * show input box
   * @param label label
   * @param placeHolder placeHolder
   * @param validateInput validate input function
   * @param value value
   * @param ignoreFocusOut identify if ignore focus out
   */
  static async showInputBox(
    label: string,
    placeHolder: string,
    validateInput?: (s: string) => string | undefined | Promise<string | undefined>,
    value?: string,
    ignoreFocusOut = true,
  ): Promise<string> {
    const options: vscode.InputBoxOptions = {
      prompt: label,
      placeHolder,
      validateInput,
      value,
      ignoreFocusOut,
    };
    const input: string | undefined = await vscode.window.showInputBox(options);
    if (!input) {
      throw new UserCancelledError(label);
    }
    return input;
  }

  /**
   * input connection string
   * @param label label
   */
  static async inputConnectionString(label: string): Promise<string> {
    const validateInput = (name: string): string|undefined => {
      return Utility.validateNotEmpty(name, "Connection string");
    };
    return await UI.showInputBox(label, UIConstants.REPOSITORY_CONNECTION_STRING_TEMPLATE, validateInput);
  }

  /**
   * select model files by type
   * @param label label
   * @param type model type
   */
  static async selectModelFiles(label: string, type?: ModelType): Promise<string[]> {
    const fileInfos: ModelFileInfo[] = await UI.findModelFiles(type);
    if (fileInfos.length === 0) {
      UI.showNotification(MessageType.Warn, UIConstants.MODELS_NOT_FOUND_MSG);
      return [];
    }
    const items: Array<QuickPickItemWithData<string>> = fileInfos.map((f) => {
      return {
        label: path.basename(f.filePath),
        description: f.id,
        data: f.filePath,
      };
    });
    const selected: Array<QuickPickItemWithData<string>> | undefined = await vscode.window.showQuickPick(items, {
      placeHolder: label,
      ignoreFocusOut: true,
      canPickMany: true,
      matchOnDescription: true,
    });
    if (!selected || selected.length === 0) {
      throw new UserCancelledError(label);
    }
    return selected.map((s) => s.data);
  }

  /**
   * select one model file
   * @param label label
   * @param type model type
   */
  static async selectOneModelFile(label: string, type?: ModelType): Promise<string> {
    const fileInfos: ModelFileInfo[] = await UI.findModelFiles(type);
    if (fileInfos.length === 0) {
      UI.showNotification(MessageType.Warn, UIConstants.MODELS_NOT_FOUND_MSG);
      return Constants.EMPTY_STRING;
    }
    const items: Array<QuickPickItemWithData<string>> = fileInfos.map((f) => {
      return {
        label: path.basename(f.filePath),
        description: f.id,
        data: f.filePath,
      };
    });
    const selected: QuickPickItemWithData<string> | undefined = await vscode.window.showQuickPick(items, {
      placeHolder: label,
      ignoreFocusOut: true,
      canPickMany: false,
      matchOnDescription: true,
    });
    if (!selected) {
      throw new UserCancelledError(label);
    }
    return selected.data;
  }

  /**
   * find model files by type
   * @param type model type
   */
  static async findModelFiles(type?: ModelType): Promise<ModelFileInfo[]> {
    const fileInfos: ModelFileInfo[] = [];
    const files: vscode.Uri[] = await vscode.workspace.findFiles(UIConstants.MODEL_FILE_GLOB);
    if (files.length === 0) {
      return fileInfos;
    }
    // process in parallel
    await Promise.all(
      files.map(async (f) => {
        let fileInfo: ModelFileInfo | undefined;
        try {
          fileInfo = await Utility.getModelFileInfo(f.fsPath);
        } catch {
          // skip if file is not a valid json
          return;
        }
        if (!fileInfo) {
          return;
        }
        if (!type || type === fileInfo.type) {
          fileInfos.push(fileInfo);
        }
      }),
    );
    return fileInfos;
  }

  /**
   * ensure files saved
   * @param label label
   * @param files file list
   */
  static async ensureFilesSaved(label: string, files: string[]): Promise<void> {
    const dirtyFiles: vscode.TextDocument[] = vscode.workspace.textDocuments.filter((f) => f.isDirty);
    const unsaved: vscode.TextDocument[] = dirtyFiles.filter((f) => files.some((file) => file === f.fileName));
    if (unsaved.length === 0) {
      return;
    }
    const nameList: string = unsaved.map((f) => path.basename(f.fileName)).toString();
    const message = `${UIConstants.ASK_TO_SAVE_MSG} [${nameList}]`;
    const choice: string | undefined = await vscode.window.showWarningMessage(
      message,
      ChoiceType.Yes,
      ChoiceType.Cancel,
    );
    if (choice === ChoiceType.Yes) {
      await Promise.all(unsaved.map((f) => f.save()));
    } else {
      throw new UserCancelledError(label);
    }
  }

  private constructor() {}
}
