// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as parser from "jsonc-parser";
import * as vscode from "vscode";
import { Constants } from "../common/constants";
import { DigitalTwinConstants } from "./digitalTwinConstants";
import { ClassNode, DigitalTwinGraph, PropertyNode, ValueSchema } from "./digitalTwinGraph";
import { IntelliSenseUtility, JsonNodeType, PropertyPair } from "./intelliSenseUtility";
import { LANGUAGE_CODE } from "./languageCode";

/**
 * Completion item provider for DigitalTwin IntelliSense
 */
export class DigitalTwinCompletionItemProvider implements vscode.CompletionItemProvider {
  /**
   * get text for json parser after completion
   * @param document text document
   * @param position position
   */
  private static getTextForParse(document: vscode.TextDocument, position: vscode.Position): string {
    const text: string = document.getText();
    const offset: number = document.offsetAt(position);
    if (text[offset] === Constants.COMPLETION_TRIGGER) {
      const edit: parser.Edit = {
        offset,
        length: 1,
        content: Constants.COMPLETION_TRIGGER + Constants.DEFAULT_SEPARATOR,
      };
      return parser.applyEdits(text, [edit]);
    }
    return text;
  }

  /**
   * create completion item
   * @param label label
   * @param isProperty identify if kind is property
   * @param insertText insert text
   * @param position position
   * @param range overwrite range for completion text
   */
  private static createCompletionItem(
    label: string,
    isProperty: boolean,
    insertText: string,
    position: vscode.Position,
    range: vscode.Range,
  ): vscode.CompletionItem {
    const completionItem: vscode.CompletionItem = {
      label,
      kind: isProperty ? vscode.CompletionItemKind.Property : vscode.CompletionItemKind.Value,
      insertText: new vscode.SnippetString(insertText),
      // the start of range should not be before position, otherwise completion item will not be shown
      range: new vscode.Range(position, range.end),
    };
    if (position.isAfter(range.start)) {
      completionItem.additionalTextEdits = [vscode.TextEdit.delete(new vscode.Range(range.start, position))];
    }
    return completionItem;
  }

  /**
   * evaluate the overwrite range for completion text
   * @param document text document
   * @param position position
   * @param node json node
   */
  private static evaluateOverwriteRange(
    document: vscode.TextDocument,
    position: vscode.Position,
    node: parser.Node,
  ): vscode.Range {
    let range: vscode.Range;
    if (node.type === JsonNodeType.String || node.type === JsonNodeType.Number || node.type === JsonNodeType.Boolean) {
      range = IntelliSenseUtility.getNodeRange(document, node);
    } else {
      const word: string = DigitalTwinCompletionItemProvider.getCurrentWord(document, position);
      const start: number = document.offsetAt(position) - word.length;
      range = new vscode.Range(document.positionAt(start), position);
    }
    return range;
  }

  /**
   * get the current word before position
   * @param document text document
   * @param position position
   */
  private static getCurrentWord(document: vscode.TextDocument, position: vscode.Position): string {
    let i: number = position.character - 1;
    const text: string = document.lineAt(position.line).text;
    while (i >= 0 && DigitalTwinConstants.WORD_STOP.indexOf(text.charAt(i)) === -1) {
      i--;
    }
    return text.substring(i + 1, position.character);
  }

  /**
   * evaluate the separator after offset
   * @param text text
   * @param offset offset
   */
  private static evaluateSeparatorAfter(text: string, offset: number): string {
    const scanner: parser.JSONScanner = parser.createScanner(text, true);
    scanner.setPosition(offset);
    const token: parser.SyntaxKind = scanner.scan();
    switch (token) {
    case parser.SyntaxKind.CommaToken:
    case parser.SyntaxKind.CloseBraceToken:
    case parser.SyntaxKind.CloseBracketToken:
    case parser.SyntaxKind.EOF:
      return Constants.EMPTY_STRING;
    default:
      return Constants.DEFAULT_SEPARATOR;
    }
  }

  /**
   * suggest completion item for property
   * @param node json node
   * @param position position
   * @param range overwrite range
   * @param includeValue identifiy if includes property value
   * @param separator separator after completion text
   */
  private static suggestProperty(
    node: parser.Node,
    position: vscode.Position,
    range: vscode.Range,
    includeValue: boolean,
    separator: string,
  ): vscode.CompletionItem[] {
    const completionItems: vscode.CompletionItem[] = [];
    const exist = new Set<string>();
    const classNode: ClassNode | undefined = DigitalTwinCompletionItemProvider.getObjectType(node, exist);
    let dummyNode: PropertyNode;
    if (!classNode) {
      // there are two cases when classNode is not defined
      // 1. there are multiple choice. In this case, ask user to specifiy @type
      // 2. invalid @type value. In this case, diagnostic shows error and user need to correct value
      if (!exist.has(DigitalTwinConstants.TYPE)) {
        // suggest @type property
        dummyNode = { id: DigitalTwinConstants.TYPE };
        completionItems.push(
          DigitalTwinCompletionItemProvider.createCompletionItem(
            `${dummyNode.id} ${DigitalTwinConstants.REQUIRED_PROPERTY_LABEL}`,
            true,
            DigitalTwinCompletionItemProvider.getInsertTextForProperty(dummyNode, includeValue, separator),
            position,
            range,
          ),
        );
      }
    } else if (IntelliSenseUtility.isLanguageNode(classNode)) {
      const stringValueSchema: ClassNode = { id: ValueSchema.String };
      for (const code of LANGUAGE_CODE) {
        if (exist.has(code)) {
          continue;
        }
        dummyNode = { id: code, range: [stringValueSchema] };
        completionItems.push(
          DigitalTwinCompletionItemProvider.createCompletionItem(
            code,
            true,
            DigitalTwinCompletionItemProvider.getInsertTextForProperty(dummyNode, includeValue, separator),
            position,
            range,
          ),
        );
      }
    } else if (classNode.properties) {
      const required =
        classNode.constraint && classNode.constraint.required
          ? new Set<string>(classNode.constraint.required)
          : new Set<string>();
      for (const child of classNode.properties) {
        if (!child.label || exist.has(child.label)) {
          continue;
        }
        completionItems.push(
          DigitalTwinCompletionItemProvider.createCompletionItem(
            DigitalTwinCompletionItemProvider.formatLabel(child.label, required),
            true,
            DigitalTwinCompletionItemProvider.getInsertTextForProperty(child, includeValue, separator),
            position,
            range,
          ),
        );
      }
      const suggestion: vscode.CompletionItem[] = DigitalTwinCompletionItemProvider.suggestReservedProperty(
        position,
        range,
        includeValue,
        separator,
        exist,
        required,
      );
      completionItems.push(...suggestion);
    }
    return completionItems;
  }

  /**
   * get the type of json object node and record existing properties
   * @param node json node
   * @param exist existing properties
   */
  private static getObjectType(node: parser.Node, exist: Set<string>): ClassNode | undefined {
    const parent: parser.Node | undefined = node.parent;
    if (!parent || parent.type !== JsonNodeType.Object || !parent.children) {
      return undefined;
    }
    let propertyName: string;
    let objectType: ClassNode | undefined;
    let propertyPair: PropertyPair | undefined;
    for (const child of parent.children) {
      if (child === node) {
        continue;
      }
      propertyPair = IntelliSenseUtility.parseProperty(child);
      if (!propertyPair || !propertyPair.name.value) {
        continue;
      }
      propertyName = propertyPair.name.value as string;
      exist.add(propertyName);
      // get from @type property
      if (propertyName === DigitalTwinConstants.TYPE) {
        const propertyValue: parser.Node = propertyPair.value;
        if (propertyValue.type === JsonNodeType.String) {
          objectType = IntelliSenseUtility.getClasNode(propertyValue.value as string);
        } else if (propertyValue.type === JsonNodeType.Array && propertyValue.children) {
          // support semantic type array
          for (const element of propertyValue.children) {
            if (element.type === JsonNodeType.String) {
              const type: string = element.value as string;
              if (type && DigitalTwinConstants.SUPPORT_SEMANTIC_TYPES.has(type)) {
                objectType = IntelliSenseUtility.getClasNode(type);
              }
            }
          }
        }
      }
    }
    // infer from outer property
    if (!objectType) {
      const propertyNode: PropertyNode | undefined = DigitalTwinCompletionItemProvider.getOuterPropertyNode(parent);
      if (propertyNode) {
        const classes: ClassNode[] = IntelliSenseUtility.getObjectClasses(propertyNode);
        if (classes.length === 1) {
          objectType = classes[0];
        }
      }
    }
    return objectType;
  }

  /**
   * get outer DigitalTwin property node from current node
   * @param node json node
   */
  private static getOuterPropertyNode(node: parser.Node): PropertyNode | undefined {
    const propertyPair: PropertyPair | undefined = IntelliSenseUtility.getOuterPropertyPair(node);
    if (!propertyPair) {
      return undefined;
    }
    const propertyName: string = IntelliSenseUtility.resolvePropertyName(propertyPair);
    return IntelliSenseUtility.getPropertyNode(propertyName);
  }

  /**
   * format property label with required information
   * @param label label
   * @param required required properties
   */
  private static formatLabel(label: string, required: Set<string>): string {
    return required.has(label) ? `${label} ${DigitalTwinConstants.REQUIRED_PROPERTY_LABEL}` : label;
  }

  /**
   * suggest completion item for reserved property
   * @param position position
   * @param range overwrite range
   * @param includeValue identifiy if includes property value
   * @param separator separator after completion text
   * @param exist existing properties
   * @param required required properties
   */
  private static suggestReservedProperty(
    position: vscode.Position,
    range: vscode.Range,
    includeValue: boolean,
    separator: string,
    exist: Set<string>,
    required: Set<string>,
  ): vscode.CompletionItem[] {
    const completionItems: vscode.CompletionItem[] = [];
    const properties: PropertyNode[] = [];
    const propertyNode: PropertyNode | undefined = IntelliSenseUtility.getPropertyNode(DigitalTwinConstants.ID);
    if (propertyNode) {
      properties.push(propertyNode);
    }
    // suggest @type property for inline Interface
    if (required.has(DigitalTwinConstants.TYPE)) {
      properties.push({ id: DigitalTwinConstants.TYPE });
    }
    for (const property of properties) {
      if (exist.has(property.id)) {
        continue;
      }
      completionItems.push(
        DigitalTwinCompletionItemProvider.createCompletionItem(
          DigitalTwinCompletionItemProvider.formatLabel(property.id, required),
          true,
          DigitalTwinCompletionItemProvider.getInsertTextForProperty(property, includeValue, separator),
          position,
          range,
        ),
      );
    }
    return completionItems;
  }

  /**
   * get insert text for property
   * @param propertyNode DigitalTwin property node
   * @param includeValue identify if insert text includes property value
   * @param separator separator after text
   */
  private static getInsertTextForProperty(
    propertyNode: PropertyNode,
    includeValue: boolean,
    separator: string,
  ): string {
    const name: string = propertyNode.label || propertyNode.id;
    if (!includeValue) {
      return name;
    }
    let value: string = Constants.EMPTY_STRING;
    if (propertyNode.isArray) {
      value = "[$1]";
    } else if (propertyNode.range && propertyNode.range.length === 1) {
      const classNode: ClassNode = propertyNode.range[0];
      if (DigitalTwinGraph.isObjectClass(classNode)) {
        value = "{$1}";
      } else if (!classNode.label) {
        switch (classNode.id) {
        case ValueSchema.String:
          value = '"$1"';
          break;
        case ValueSchema.Int:
          value = "${1:0}";
          break;
        case ValueSchema.Boolean:
          value = "${1:false}";
          break;
        default:
        }
      }
    }
    const tail: string = value ? separator : Constants.EMPTY_STRING;
    return `"${name}": ${value}${tail}`;
  }

  /**
   * suggest completion item for property value
   * @param node json node
   * @param position position
   * @param range overwrite range
   * @param separator separator after completion text
   */
  private static suggestValue(
    node: parser.Node,
    position: vscode.Position,
    range: vscode.Range,
    separator: string,
  ): vscode.CompletionItem[] {
    const completionItems: vscode.CompletionItem[] = [];
    const propertyPair: PropertyPair | undefined = IntelliSenseUtility.parseProperty(node);
    if (!propertyPair) {
      return completionItems;
    }
    let propertyNode: PropertyNode | undefined;
    let propertyName: string = propertyPair.name.value as string;
    if (propertyName === DigitalTwinConstants.CONTEXT) {
      // suggest value of @context property
      completionItems.push(
        DigitalTwinCompletionItemProvider.createCompletionItem(
          DigitalTwinConstants.IOT_MODEL_LABEL,
          false,
          DigitalTwinCompletionItemProvider.getInsertTextForValue(DigitalTwinConstants.CONTEXT_TEMPLATE, separator),
          position,
          range,
        ),
      );
    } else if (propertyName === DigitalTwinConstants.TYPE) {
      // suggest value of @type property
      if (node.parent) {
        // assign to entry node if the json object node is the top node
        propertyNode =
          DigitalTwinCompletionItemProvider.getOuterPropertyNode(node.parent) || IntelliSenseUtility.getEntryNode();
        if (propertyNode) {
          const classes: ClassNode[] = IntelliSenseUtility.getObjectClasses(propertyNode);
          for (const classNode of classes) {
            const value: string = DigitalTwinGraph.getClassType(classNode);
            completionItems.push(
              DigitalTwinCompletionItemProvider.createCompletionItem(
                value,
                false,
                DigitalTwinCompletionItemProvider.getInsertTextForValue(value, separator),
                position,
                range,
              ),
            );
          }
        }
      }
    } else {
      // suggest property value
      propertyName = IntelliSenseUtility.resolvePropertyName(propertyPair);
      propertyNode = IntelliSenseUtility.getPropertyNode(propertyName);
      if (propertyNode) {
        const enums = IntelliSenseUtility.getEnums(propertyNode);
        for (const value of enums) {
          completionItems.push(
            DigitalTwinCompletionItemProvider.createCompletionItem(
              value,
              false,
              DigitalTwinCompletionItemProvider.getInsertTextForValue(value, separator),
              position,
              range,
            ),
          );
        }
      }
    }
    return completionItems;
  }

  /**
   * get insert text for property value
   * @param value property value
   * @param separator separator after text
   */
  private static getInsertTextForValue(value: string, separator: string): string {
    return `"${value}"${separator}`;
  }

  /**
   * provide completion items
   * @param document text document
   * @param position position
   * @param token cancellation token
   * @param context completion context
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken, _context: vscode.CompletionContext,
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const text: string = DigitalTwinCompletionItemProvider.getTextForParse(document, position);
    const jsonNode: parser.Node | undefined = IntelliSenseUtility.parseDigitalTwinModel(text);
    if (!jsonNode) {
      return undefined;
    }
    if (!IntelliSenseUtility.enabled()) {
      return undefined;
    }
    const node: parser.Node | undefined = parser.findNodeAtOffset(jsonNode, document.offsetAt(position));
    if (!node || node.type !== JsonNodeType.String) {
      return undefined;
    }
    const range: vscode.Range = DigitalTwinCompletionItemProvider.evaluateOverwriteRange(document, position, node);
    const separator: string = DigitalTwinCompletionItemProvider.evaluateSeparatorAfter(
      document.getText(),
      document.offsetAt(range.end),
    );
    const parent: parser.Node | undefined = node.parent;
    if (!parent || parent.type !== JsonNodeType.Property || !parent.children) {
      return undefined;
    }
    if (node === parent.children[0]) {
      const includeValue: boolean = parent.children.length < 2;
      return DigitalTwinCompletionItemProvider.suggestProperty(parent, position, range, includeValue, separator);
    } else {
      return DigitalTwinCompletionItemProvider.suggestValue(parent, position, range, separator);
    }
  }
}
