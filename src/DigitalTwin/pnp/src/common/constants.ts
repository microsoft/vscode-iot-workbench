// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

/**
 * Common constants
 */
export class Constants {
  static readonly EXTENSION_NAME = "azure-digital-twins";
  static readonly CHANNEL_NAME = "IoT Plug and Play";
  static readonly UTF8 = "utf8";
  static readonly BASE64 = "base64";
  static readonly SHA256 = "sha256";
  static readonly HEX = "hex";
  static readonly EMPTY_STRING = "";
  static readonly DEFAULT_SEPARATOR = ",";
  static readonly COMPLETION_TRIGGER = '"';
  static readonly LINE_FEED = "\n";
  static readonly JSON_SPACE = 2;
  static readonly NOT_FOUND_CODE = 404;
  static readonly DEFAULT_PAGE_SIZE = 50;
  static readonly DEFAULT_TIMER_MS = 1000;
  static readonly RESOURCE_FOLDER = "resources/pnp";
  static readonly TEMPLATE_FOLDER = "templates";
  static readonly DEFINITION_FOLDER = "definitions";
  static readonly SAMPLE_FILE_NAME = "sample";
  static readonly GRAPH_FILE_NAME = "graph.json";
  static readonly CONTEXT_FILE_NAME = "context.json";
  static readonly CONSTRAINT_FILE_NAME = "constraint.json";

  static readonly DEVICE_MODEL_COMPONENT = "Device Model";
  static readonly MODEL_REPOSITORY_COMPONENT = "Model Repository";
  static readonly MODEL_REPOSITORY_CONNECTION_KEY = "ModelRepositoryConnectionKey";
  static readonly MODEL_REPOSITORY_API_VERSION = "2019-07-01-Preview";
  static readonly URL_PROTOCAL_REGEX = new RegExp("^[a-zA-Z]+://");
  static readonly HTTPS_PROTOCAL = "https://";
  static readonly MODEL_NAME_REGEX = new RegExp("^[a-zA-Z_][a-zA-Z0-9_]*$");
  static readonly MODEL_NAME_REGEX_DESCRIPTION = "alphanumeric and underscore, not start with number";
  static readonly DIGITAL_TWIN_ID_PLACEHOLDER = "{DigitalTwinIdentifier}";

  static readonly EXTENSION_ACTIVATED_MSG = "extensionActivated";
  static readonly NOT_EMPTY_MSG = "could not be empty";
  static readonly CONNECTION_STRING_NOT_FOUND_MSG =
    "Company repository connection string is not found. Please sign out and sign in with a valid connection string";
  static readonly PUBLIC_REPOSITORY_URL_NOT_FOUND_MSG = "Public repository url is not found";
  static readonly CONNECTION_STRING_INVALID_FORMAT_MSG = "Invalid connection string format";
  static readonly NEED_OPEN_COMPANY_REPOSITORY_MSG = "Please open company repository and try again";

  static readonly NSAT_SURVEY_URL = "https://aka.ms/vscode-iot-workbench-survey";
  static readonly WEB_VIEW_PATH = "assets/modelRepository";
  static readonly COMPANY_REPOSITORY_PAGE = "index.html";
  static readonly PUBLIC_REPOSITORY_PAGE = "index.html?public";
  static readonly PUBLIC_REPOSITORY_URL = "publicRepositoryUrl";
}
