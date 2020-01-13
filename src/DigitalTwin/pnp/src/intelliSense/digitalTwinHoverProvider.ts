// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as parser from "jsonc-parser";
import * as vscode from "vscode";
import { Constants } from "../common/constants";
import { DigitalTwinConstants } from "./digitalTwinConstants";
import { PropertyNode } from "./digitalTwinGraph";
import { IntelliSenseUtility, PropertyPair } from "./intelliSenseUtility";

/**
 * Hover provider for DigitalTwin IntelliSense
 */
export class DigitalTwinHoverProvider implements vscode.HoverProvider {
  /**
   * get hover content
   * @param propertyName property name
   */
  private static getContent(propertyName: string): string {
    if (!propertyName) {
      return Constants.EMPTY_STRING;
    }
    switch (propertyName) {
      case DigitalTwinConstants.ID:
        return `An identifier for ${Constants.CHANNEL_NAME} Capability Model or interface`;
      case DigitalTwinConstants.TYPE:
        return `The type of ${Constants.CHANNEL_NAME} meta model object`;
      case DigitalTwinConstants.CONTEXT:
        return `The context for ${Constants.CHANNEL_NAME} Capability Model or interface`;
      default: {
        const propertyNode: PropertyNode | undefined = IntelliSenseUtility.getPropertyNode(propertyName);
        return propertyNode && propertyNode.comment ? propertyNode.comment : Constants.EMPTY_STRING;
      }
    }
  }

  /**
   * provide hover
   * @param document text document
   * @param position position
   * @param token cancellation token
   */
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const jsonNode: parser.Node | undefined = IntelliSenseUtility.parseDigitalTwinModel(document.getText());
    if (!jsonNode) {
      return undefined;
    }
    if (!IntelliSenseUtility.enabled()) {
      return undefined;
    }
    const node: parser.Node | undefined = parser.findNodeAtOffset(jsonNode, document.offsetAt(position));
    if (!node || !node.parent) {
      return undefined;
    }
    const propertyPair: PropertyPair | undefined = IntelliSenseUtility.parseProperty(node.parent);
    if (!propertyPair) {
      return undefined;
    }
    const propertyName: string = IntelliSenseUtility.resolvePropertyName(propertyPair);
    const content: string = DigitalTwinHoverProvider.getContent(propertyName);
    return content ? new vscode.Hover(content, IntelliSenseUtility.getNodeRange(document, node.parent)) : undefined;
  }
}
