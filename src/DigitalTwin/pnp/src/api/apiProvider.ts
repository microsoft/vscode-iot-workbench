// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ModelType } from "../deviceModel/deviceModelManager";
import { ModelRepositoryManager } from "../modelRepository/modelRepositoryManager";
import { UI } from "../view/ui";
import { UIConstants } from "../view/uiConstants";

/**
 * Api provider for extension integration
 */
export class ApiProvider {
  constructor(
    private readonly modelRepositoryManager: ModelRepositoryManager
  ) {}

  /**
   * select capability model
   */
  async selectCapabilityModel(): Promise<string> {
    return await UI.selectOneModelFile(
      UIConstants.SELECT_CAPABILITY_MODEL_LABEL,
      ModelType.CapabilityModel
    );
  }

  /**
   * download dependent interface of capability model
   * @param folder folder to download interface
   * @param capabilityModelFile capability model file path
   */
  async downloadDependentInterface(
    folder: string,
    capabilityModelFile: string
  ): Promise<void> {
    await this.modelRepositoryManager.downloadDependentInterface(
      folder,
      capabilityModelFile
    );
  }
}
