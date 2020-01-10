// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

/**
 * Constants for UI
 */
export class UIConstants {
  static readonly SELECT_ROOT_FOLDER_LABEL = "Select folder";
  static readonly INPUT_MODEL_NAME_LABEL = "Input device model name";
  static readonly BROWSE_LABEL = "Browse...";
  static readonly SELECT_REPOSITORY_LABEL = "Select model repository";
  static readonly SELECT_MODELS_LABEL = "Select device models";
  static readonly SELECT_CAPABILITY_MODEL_LABEL = "Select a capability model";
  static readonly INPUT_REPOSITORY_CONNECTION_STRING_LABEL =
    "Input company repository connection string";
  static readonly SAVE_FILE_CHANGE_LABEL = "Save file change";
  static readonly MODEL_REPOSITORY_TITLE = "IoT Plug and Play Model Repository";
  static readonly MODEL_FILE_GLOB = "**/*.json";
  static readonly REPOSITORY_CONNECTION_STRING_TEMPLATE =
    "HostName=<Host Name>;RepositoryId=<repository id>;" +
    "SharedAccessKeyName=<Shared AccessKey Name>;SharedAccessKey=<access Key>";
  static readonly MODELS_NOT_FOUND_MSG =
    "No device model is found in current workspace. Please open the folder that contains models and try again";
  static readonly ASK_TO_SAVE_MSG =
    "The following files contain unsaved changes, do you want to save them?";
  static readonly ASK_TO_OVERWRITE_MSG = "do you want to overwrite it?";
}
