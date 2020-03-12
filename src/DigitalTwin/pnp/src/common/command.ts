// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

/**
 * Command type
 */
export enum Command {
  CreateInterface = "azure-digital-twins.createInterface",
  CreateCapabilityModel = "azure-digital-twins.createCapabilityModel",
  OpenRepository = "azure-digital-twins.openRepository",
  SignOutRepository = "azure-digital-twins.signOutRepository",
  SearchInterface = "azure-digital-twins.searchInterface",
  SearchCapabilityModel = "azure-digital-twins.searchCapabilityModel",
  SubmitFiles = "azure-digital-twins.submitFiles",
  DeleteModels = "azure-digital-twins.deleteModels",
  DownloadModels = "azure-digital-twins.downloadModels",
  OpenModelFile = "azure-digital-twins.openModelFile"
}
