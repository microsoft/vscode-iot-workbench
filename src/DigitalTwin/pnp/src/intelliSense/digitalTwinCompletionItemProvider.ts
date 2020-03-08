// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as parser from "jsonc-parser";
import * as vscode from "vscode";
import { Constants } from "../common/constants";
import { DigitalTwinConstants } from "./digitalTwinConstants";
import { ClassNode, PropertyNode, ValueSchema } from "./digitalTwinGraph";
import { IntelliSenseUtility, JsonNodeType, PropertyPair, ModelContent } from "./intelliSenseUtility";
import { LANGUAGE_CODE } from "./languageCode";

/**
 * Diagnostic problem
 */
interface Suggestion {
  isProperty: boolean;
  label: string;
  insertText: string;
}

/**
 * Completion item provider for DigitalTwin IntelliSense
 */
export class DigitalTwinCompletionItemProvider implements vscode.CompletionItemProvider {
  /**
   * complete text to be valid json content
   * @param document text document
   * @param position position
   */
  private static completeTextForParse(document: vscode.TextDocument, position: vscode.Position): string {
    const text: string = document.getText();
    const offset: number = document.offsetAt(position);
    if (text[offset] === Constants.COMPLETION_TRIGGER) {
      const edit: parser.Edit = {
        offset,
        length: 1,
        content: Constants.COMPLETION_TRIGGER + Constants.DEFAULT_SEPARATOR
      };
      return parser.applyEdits(text, [edit]);
    }
    return text;
  }

  /**
   * create completion item
   * @param suggestion suggestion
   * @param position position
   * @param range overwrite range
   * @param separator separator
   */
  private static createCompletionItem(
    suggestion: Suggestion,
    position: vscode.Position,
    range: vscode.Range,
    separator: string
  ): vscode.CompletionItem {
    const completionItem: vscode.CompletionItem = {
      label: suggestion.label,
      kind: suggestion.isProperty ? vscode.CompletionItemKind.Property : vscode.CompletionItemKind.Value,
      insertText: new vscode.SnippetString(suggestion.insertText + separator),
      // the start of range should be after position, otherwise completion item will not be shown
      range: new vscode.Range(position, range.end)
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
    node: parser.Node
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
   * evaluate if need add separator after offset
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
   * @param version target version
   * @param node json node
   * @param includeValue identifiy if includes property value
   * @param suggestions suggestion collection
   */
  private static suggestProperty(
    version: number,
    node: parser.Node,
    includeValue: boolean,
    suggestions: Suggestion[]
  ): void {
    const exist = new Set<string>();
    let classNode: ClassNode | undefined = DigitalTwinCompletionItemProvider.getObjectType(version, node, exist);
    // class is not avaiable in target version
    if (classNode && !IntelliSenseUtility.isAvailableByVersion(version, classNode.version)) {
      classNode = undefined;
    }
    let dummyNode: PropertyNode;
    if (!classNode) {
      // there are 3 cases when classNode is not defined
      // 1. there are multiple choice. In this case, ask user to specifiy @type
      // 2. invalid @type value. In this case, diagnostic shows error and user need to correct value
      // 3. type is not avaiable in target version. In this case, same behavior as case 2
      if (!exist.has(DigitalTwinConstants.TYPE)) {
        // suggest @type property
        dummyNode = { id: DigitalTwinConstants.TYPE };
        suggestions.push({
          isProperty: true,
          label: `${dummyNode.id} ${DigitalTwinConstants.REQUIRED_PROPERTY_LABEL}`,
          insertText: DigitalTwinCompletionItemProvider.getInsertTextForProperty(dummyNode, includeValue)
        });
      }
    } else if (IntelliSenseUtility.isLanguageNode(classNode)) {
      // suggest language code
      const stringValueSchema: ClassNode = { id: ValueSchema.String };
      dummyNode = { id: Constants.EMPTY_STRING, range: [stringValueSchema] };
      for (const code of LANGUAGE_CODE) {
        if (exist.has(code)) {
          continue;
        }
        dummyNode.id = code;
        suggestions.push({
          isProperty: true,
          label: code,
          insertText: DigitalTwinCompletionItemProvider.getInsertTextForProperty(dummyNode, includeValue)
        });
      }
    } else {
      const required =
        classNode.constraint && classNode.constraint.required
          ? new Set<string>(classNode.constraint.required)
          : new Set<string>();
      for (const property of IntelliSenseUtility.getPropertiesOfClassByVersion(classNode, version)) {
        if (!property.label || exist.has(property.label)) {
          continue;
        }
        suggestions.push({
          isProperty: true,
          label: DigitalTwinCompletionItemProvider.formatLabel(property.label, required),
          insertText: DigitalTwinCompletionItemProvider.getInsertTextForProperty(property, includeValue)
        });
      }
      // suggest reversed property
      DigitalTwinCompletionItemProvider.suggestReservedProperty(includeValue, exist, required, suggestions);
      required.clear();
    }
    exist.clear();
  }

  /**
   * get object type of json node and record existing properties
   * @param version target version
   * @param node json node
   * @param exist existing properties
   */
  private static getObjectType(version: number, node: parser.Node, exist: Set<string>): ClassNode | undefined {
    // get json node of Object
    const parent: parser.Node | undefined = node.parent;
    if (!parent || parent.type !== JsonNodeType.Object || !parent.children) {
      return undefined;
    }
    let propertyName: string;
    let objectType: ClassNode | undefined;
    let propertyPair: PropertyPair | undefined;
    for (const child of parent.children) {
      // skip current node since it has no name yet
      if (child === node) {
        continue;
      }
      propertyPair = IntelliSenseUtility.parseProperty(child);
      if (!propertyPair) {
        continue;
      }
      propertyName = propertyPair.name.value as string;
      exist.add(propertyName);
      // get from @type property
      if (propertyName === DigitalTwinConstants.TYPE) {
        const propertyValue: parser.Node = propertyPair.value;
        if (propertyValue.type === JsonNodeType.String) {
          // not return here since it need record all existing properties
          objectType = IntelliSenseUtility.getClasNode(propertyValue.value as string);
        } else if (propertyValue.type === JsonNodeType.Array && propertyValue.children) {
          // support semantic types
          for (const child of propertyValue.children) {
            if (child.type !== JsonNodeType.String) {
              continue;
            }
            const type: string = child.value as string;
            if (type && DigitalTwinConstants.SUPPORT_SEMANTIC_TYPES.has(type)) {
              objectType = IntelliSenseUtility.getClasNode(type);
            }
          }
        }
      }
    }
    // infer from outer property
    if (!objectType) {
      const propertyNode: PropertyNode | undefined = DigitalTwinCompletionItemProvider.getOuterPropertyNode(parent);
      if (propertyNode) {
        const classes: ClassNode[] = IntelliSenseUtility.getObjectClasses(propertyNode, version);
        // object type should be definite
        if (classes.length === 1) {
          objectType = classes[0];
        }
      }
    }
    return objectType;
  }

  /**
   * get outer DigitalTwin property node
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
   * @param includeValue identifiy if includes property value
   * @param exist existing properties
   * @param required required properties
   * @param suggestions suggestion collection
   */
  private static suggestReservedProperty(
    includeValue: boolean,
    exist: Set<string>,
    required: Set<string>,
    suggestions: Suggestion[]
  ): void {
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
      suggestions.push({
        isProperty: true,
        label: DigitalTwinCompletionItemProvider.formatLabel(property.id, required),
        insertText: DigitalTwinCompletionItemProvider.getInsertTextForProperty(property, includeValue)
      });
    }
    properties.length = 0;
  }

  /**
   * get insert text for property
   * @param propertyNode DigitalTwin property node
   * @param includeValue identify if insert text includes property value
   */
  private static getInsertTextForProperty(propertyNode: PropertyNode, includeValue: boolean): string {
    const name: string = propertyNode.label || propertyNode.id;
    if (!includeValue) {
      return name;
    }
    // provide value snippet according to property type
    let value = "$1";
    if (propertyNode.isArray) {
      value = "[$1]";
    } else if (propertyNode.range && propertyNode.range.length === 1) {
      // property type should be definite
      const classNode: ClassNode = propertyNode.range[0];
      if (IntelliSenseUtility.isObjectClass(classNode)) {
        value = "{$1}";
      } else if (!classNode.label) {
        // class is value schema
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
    return `"${name}": ${value}`;
  }

  /**
   * suggest completion item for property value
   * @param version target version
   * @param node json node
   * @param suggestions suggestion collection
   */
  private static suggestValue(version: number, node: parser.Node, suggestions: Suggestion[]): void {
    const propertyPair: PropertyPair | undefined = IntelliSenseUtility.parseProperty(node);
    if (!propertyPair) {
      return;
    }
    let propertyNode: PropertyNode | undefined;
    let propertyName: string = propertyPair.name.value as string;
    if (propertyName === DigitalTwinConstants.TYPE) {
      // suggest value of @type property
      if (!node.parent) {
        return;
      }
      // assign to entry node if json object node is the top node
      propertyNode =
        DigitalTwinCompletionItemProvider.getOuterPropertyNode(node.parent) || IntelliSenseUtility.getEntryNode();
      if (propertyNode) {
        let value: string;
        const classes: ClassNode[] = IntelliSenseUtility.getObjectClasses(propertyNode, version);
        for (const classNode of classes) {
          value = IntelliSenseUtility.getClassType(classNode);
          suggestions.push({
            isProperty: false,
            label: value,
            insertText: `"${value}"`
          });
        }
      }
    } else {
      // suggest enum value
      propertyName = IntelliSenseUtility.resolvePropertyName(propertyPair);
      propertyNode = IntelliSenseUtility.getPropertyNode(propertyName);
      if (propertyNode) {
        const enums = IntelliSenseUtility.getEnums(propertyNode, version);
        for (const value of enums) {
          suggestions.push({
            isProperty: false,
            label: value,
            insertText: `"${value}"`
          });
        }
      }
    }
  }

  /**
   * provide completion items
   * @param document text document
   * @param position position
   */
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    if (!IntelliSenseUtility.enabled()) {
      return undefined;
    }
    const text: string = DigitalTwinCompletionItemProvider.completeTextForParse(document, position);
    const modelContent: ModelContent | undefined = IntelliSenseUtility.parseDigitalTwinModel(text);
    if (!modelContent) {
      return undefined;
    }
    const node: parser.Node | undefined = parser.findNodeAtOffset(modelContent.jsonNode, document.offsetAt(position));
    if (!node || node.type !== JsonNodeType.String) {
      return undefined;
    }
    // get json node of Property
    const parent: parser.Node | undefined = node.parent;
    if (!parent || parent.type !== JsonNodeType.Property || !parent.children) {
      return undefined;
    }
    let completionItems: vscode.CompletionItem[] = [];
    const suggestions: Suggestion[] = [];
    // find out the current node is property name or property value
    if (node === parent.children[0]) {
      const includeValue: boolean = parent.children.length < 2;
      DigitalTwinCompletionItemProvider.suggestProperty(modelContent.version, parent, includeValue, suggestions);
    } else {
      DigitalTwinCompletionItemProvider.suggestValue(modelContent.version, parent, suggestions);
    }
    const range: vscode.Range = DigitalTwinCompletionItemProvider.evaluateOverwriteRange(document, position, node);
    const separator: string = DigitalTwinCompletionItemProvider.evaluateSeparatorAfter(
      document.getText(),
      document.offsetAt(range.end)
    );
    completionItems = suggestions.map(s =>
      DigitalTwinCompletionItemProvider.createCompletionItem(s, position, range, separator)
    );
    suggestions.length = 0;
    return completionItems;
  }
}
