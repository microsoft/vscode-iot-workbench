// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as parser from "jsonc-parser";
import * as vscode from "vscode";
import { Constants } from "../common/constants";
import { DiagnosticMessage, DigitalTwinConstants } from "./digitalTwinConstants";
import { ClassNode, PropertyNode, ValueSchema } from "./digitalTwinGraph";
import { IntelliSenseUtility, JsonNodeType, PropertyPair, ModelContent } from "./intelliSenseUtility";
import { LANGUAGE_CODE } from "./languageCode";

/**
 * Diagnostic problem
 */
interface Problem {
  offset: number;
  length: number;
  message: string;
}

/**
 * Diagnostic provider for DigitalTwin IntelliSense
 */
export class DigitalTwinDiagnosticProvider {
  /**
   * find class node by type
   * @param propertyNode DigitalTwin property node
   * @param type class type
   */
  private static findClassNode(propertyNode: PropertyNode, type: string): ClassNode | undefined {
    if (propertyNode.range) {
      return propertyNode.range.find(classNode => IntelliSenseUtility.getClassType(classNode) === type);
    }
    return undefined;
  }

  /**
   * get property pair of name property
   * @param jsonNode json node
   */
  private static getNamePropertyPair(jsonNode: parser.Node): PropertyPair | undefined {
    if (jsonNode.type !== JsonNodeType.Object || !jsonNode.children) {
      return undefined;
    }
    let propertyPair: PropertyPair | undefined;
    for (const child of jsonNode.children) {
      propertyPair = IntelliSenseUtility.parseProperty(child);
      if (!propertyPair) {
        continue;
      }
      if (propertyPair.name.value === DigitalTwinConstants.NAME) {
        return propertyPair;
      }
    }
    return undefined;
  }

  /**
   * add problem of invalid type
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static addProblemOfInvalidType(
    jsonNode: parser.Node,
    digitalTwinNode: PropertyNode,
    problems: Problem[]
  ): void {
    const validTypes: string[] = IntelliSenseUtility.getValidTypes(digitalTwinNode);
    const message: string = [DiagnosticMessage.InvalidType, ...validTypes].join(Constants.LINE_FEED);
    DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
  }

  /**
   * add problem of unexpected property
   * @param jsonNode json node
   * @param problems problem collection
   */
  private static addProblemOfUnexpectedProperty(jsonNode: parser.Node, problems: Problem[]): void {
    const message = `${jsonNode.value as string} ${DiagnosticMessage.UnexpectedProperty}`;
    DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
  }

  /**
   * add problem
   * @param jsonNode json node
   * @param problems problem collection
   * @param message diagnostic message
   * @param isContainer identify if json node is a container (e.g. object or array)
   */
  private static addProblem(jsonNode: parser.Node, problems: Problem[], message: string, isContainer?: boolean): void {
    const length: number = isContainer ? 0 : jsonNode.length;
    problems.push({ offset: jsonNode.offset, length, message });
  }

  /**
   * validate json node by DigitalTwin graph, add problem in problem collection
   * @param version target version
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static validateNode(
    version: number,
    jsonNode: parser.Node,
    digitalTwinNode: PropertyNode,
    problems: Problem[]
  ): void {
    switch (jsonNode.type) {
      case JsonNodeType.Object:
        DigitalTwinDiagnosticProvider.validateObjectNode(version, jsonNode, digitalTwinNode, problems);
        break;
      case JsonNodeType.Array:
        DigitalTwinDiagnosticProvider.validateArrayNode(version, jsonNode, digitalTwinNode, problems);
        break;
      case JsonNodeType.String:
        DigitalTwinDiagnosticProvider.validateStringNode(version, jsonNode, digitalTwinNode, problems);
        break;
      case JsonNodeType.Number:
        DigitalTwinDiagnosticProvider.validateNumberNode(jsonNode, digitalTwinNode, problems);
        break;
      case JsonNodeType.Boolean:
        DigitalTwinDiagnosticProvider.validateBooleanNode(jsonNode, digitalTwinNode, problems);
        break;
      default:
    }
  }

  /**
   * validate Object json node
   * @param version target version
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static validateObjectNode(
    version: number,
    jsonNode: parser.Node,
    digitalTwinNode: PropertyNode,
    problems: Problem[]
  ): void {
    const classes: ClassNode[] = IntelliSenseUtility.getObjectClasses(digitalTwinNode, version);
    if (!classes.length) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.NotObjectType);
      return;
    }
    if (!jsonNode.children || !jsonNode.children.length) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.EmptyObject, true);
      return;
    }
    const typePath: parser.JSONPath = [DigitalTwinConstants.TYPE];
    const typeNode: parser.Node | undefined = parser.findNodeAtLocation(jsonNode, typePath);
    // @type is required when there are multiple choice
    if (!typeNode && classes.length !== 1) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.MissingType, true);
      return;
    }
    // validate @type property
    let classNode: ClassNode | undefined;
    if (typeNode) {
      classNode = DigitalTwinDiagnosticProvider.getValidObjectType(typeNode, digitalTwinNode, classes, problems);
    } else {
      classNode = classes[0];
    }
    if (!classNode) {
      return;
    }
    // validate language node
    if (IntelliSenseUtility.isLanguageNode(classNode)) {
      DigitalTwinDiagnosticProvider.validateLanguageNode(version, jsonNode, digitalTwinNode, problems);
      return;
    }
    // validate other properties
    const expect = new Set<string>();
    const exist = new Set<string>();
    DigitalTwinDiagnosticProvider.validateProperties(version, jsonNode, classNode, problems, expect, exist);
    // validate required property
    if (classNode.constraint && classNode.constraint.required) {
      const requiredProperties: string[] = classNode.constraint.required.filter(property => {
        // property is not available in version
        if (!IntelliSenseUtility.isReservedName(property) && !expect.has(property)) {
          return false;
        }
        // @context is not required for inline Interface
        if (property === DigitalTwinConstants.CONTEXT && digitalTwinNode.label === DigitalTwinConstants.SCHEMA) {
          return false;
        }
        return !exist.has(property);
      });
      if (requiredProperties.length) {
        const message: string = [DiagnosticMessage.MissingRequiredProperties, ...requiredProperties].join(
          Constants.LINE_FEED
        );
        DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message, true);
      }
      requiredProperties.length = 0;
    }
    expect.clear();
    exist.clear();
  }

  /**
   * get valid object type from classes
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param classes class node collection
   * @param problems problem collection
   */
  private static getValidObjectType(
    jsonNode: parser.Node,
    digitalTwinNode: PropertyNode,
    classes: ClassNode[],
    problems: Problem[]
  ): ClassNode | undefined {
    let classNode: ClassNode | undefined;
    const dummyNode: PropertyNode = {
      id: DigitalTwinConstants.DUMMY_NODE,
      range: classes
    };
    if (jsonNode.type === JsonNodeType.String) {
      classNode = DigitalTwinDiagnosticProvider.findClassNode(dummyNode, jsonNode.value as string);
    } else if (
      jsonNode.type === JsonNodeType.Array &&
      jsonNode.children &&
      digitalTwinNode.label === DigitalTwinConstants.CONTENTS
    ) {
      // support semantic types
      let currentNode: ClassNode | undefined;
      for (const child of jsonNode.children) {
        if (child.type !== JsonNodeType.String) {
          classNode = undefined;
          break;
        }
        // validate conflict type
        currentNode = DigitalTwinDiagnosticProvider.findClassNode(dummyNode, child.value as string);
        if (currentNode) {
          if (classNode) {
            const message = `${DiagnosticMessage.ConflictType} ${classNode.label} and ${currentNode.label}`;
            DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
            return undefined;
          } else {
            classNode = currentNode;
          }
        }
      }
    }
    if (!classNode) {
      DigitalTwinDiagnosticProvider.addProblemOfInvalidType(jsonNode, dummyNode, problems);
    }
    return classNode;
  }

  /**
   * validate properties of Object json node
   * @param version target version
   * @param jsonNode json node
   * @param classNode class node
   * @param problems problem colletion
   * @param expect expected properties
   * @param exist existing properties
   */
  private static validateProperties(
    version: number,
    jsonNode: parser.Node,
    classNode: ClassNode,
    problems: Problem[],
    expect: Set<string>,
    exist: Set<string>
  ): void {
    if (!jsonNode.children) {
      return;
    }
    const expectedProperties = new Map<string, PropertyNode>();
    for (const property of IntelliSenseUtility.getPropertiesOfClassByVersion(classNode, version)) {
      if (property.label) {
        expect.add(property.label);
        expectedProperties.set(property.label, property);
      }
    }
    let propertyName: string;
    let propertyPair: PropertyPair | undefined;
    let propertyNode: PropertyNode | undefined;
    for (const child of jsonNode.children) {
      propertyPair = IntelliSenseUtility.parseProperty(child);
      if (!propertyPair) {
        continue;
      }
      propertyName = propertyPair.name.value as string;
      // duplicate property name is handled by json validator
      exist.add(propertyName);
      switch (propertyName) {
        case DigitalTwinConstants.ID:
          // @id is available for each class
          // TODO(erichen): @id format may be differnt in v2
          propertyNode = IntelliSenseUtility.getPropertyNode(DigitalTwinConstants.ID);
          if (propertyNode) {
            DigitalTwinDiagnosticProvider.validateNode(version, propertyPair.value, propertyNode, problems);
          }
          break;
        case DigitalTwinConstants.CONTEXT:
          // @context is available when it is required
          if (
            classNode.constraint &&
            classNode.constraint.required &&
            classNode.constraint.required.includes(DigitalTwinConstants.CONTEXT)
          ) {
            if (IntelliSenseUtility.getDigitalTwinVersion(propertyPair.value) !== version) {
              DigitalTwinDiagnosticProvider.addProblem(propertyPair.value, problems, DiagnosticMessage.InvalidContext);
            }
          } else {
            DigitalTwinDiagnosticProvider.addProblemOfUnexpectedProperty(propertyPair.name, problems);
          }
          break;
        case DigitalTwinConstants.TYPE:
          // skip since @type is already validated
          break;
        default:
          // validate expected property
          // TODO(erichen): semantic types may have additional property
          propertyNode = expectedProperties.get(propertyName);
          if (!propertyNode) {
            DigitalTwinDiagnosticProvider.addProblemOfUnexpectedProperty(propertyPair.name, problems);
          } else {
            DigitalTwinDiagnosticProvider.validateNode(version, propertyPair.value, propertyNode, problems);
          }
      }
    }
    expectedProperties.clear();
  }

  /**
   * validate Array json node
   * @param version target version
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static validateArrayNode(
    version: number,
    jsonNode: parser.Node,
    digitalTwinNode: PropertyNode,
    problems: Problem[]
  ): void {
    if (!digitalTwinNode.isArray) {
      DigitalTwinDiagnosticProvider.addProblemOfInvalidType(jsonNode, digitalTwinNode, problems);
      return;
    }
    if (!jsonNode.children || !jsonNode.children.length) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.EmptyArray, true);
      return;
    }
    // validate item constraint
    let message: string;
    if (digitalTwinNode.constraint) {
      if (digitalTwinNode.constraint.minItems && jsonNode.children.length < digitalTwinNode.constraint.minItems) {
        message = `${DiagnosticMessage.TooFewItems} ${digitalTwinNode.constraint.minItems}.`;
        DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message, true);
      } else if (
        digitalTwinNode.constraint.maxItems &&
        jsonNode.children.length > digitalTwinNode.constraint.maxItems
      ) {
        message = `${DiagnosticMessage.TooManyItems} ${digitalTwinNode.constraint.maxItems}.`;
        DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message, true);
      }
    }
    // validate item uniqueness by name
    let propertyPair: PropertyPair | undefined;
    let objectName: string;
    const exist = new Set<string>();
    for (const child of jsonNode.children) {
      propertyPair = DigitalTwinDiagnosticProvider.getNamePropertyPair(child);
      if (propertyPair) {
        objectName = propertyPair.value.value as string;
        if (exist.has(objectName)) {
          message = `${objectName} ${DiagnosticMessage.DuplicateItem}`;
          DigitalTwinDiagnosticProvider.addProblem(propertyPair.value, problems, message);
        } else {
          exist.add(objectName);
        }
      }
      // validate each item
      DigitalTwinDiagnosticProvider.validateNode(version, child, digitalTwinNode, problems);
    }
    exist.clear();
  }

  /**
   * validate String json node
   * @param version target version
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static validateStringNode(
    version: number,
    jsonNode: parser.Node,
    digitalTwinNode: PropertyNode,
    problems: Problem[]
  ): void {
    const classNode: ClassNode | undefined = DigitalTwinDiagnosticProvider.findClassNode(
      digitalTwinNode,
      ValueSchema.String
    );
    // validate enum node
    if (!classNode) {
      DigitalTwinDiagnosticProvider.validateEnumNode(version, jsonNode, digitalTwinNode, problems);
      return;
    }
    const value: string = jsonNode.value as string;
    if (!value) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.EmptyString);
      return;
    }
    // validate string constraint
    let message: string;
    if (digitalTwinNode.constraint) {
      if (digitalTwinNode.constraint.minLength && value.length < digitalTwinNode.constraint.minLength) {
        message = `${DiagnosticMessage.ShorterThanMinLength} ${digitalTwinNode.constraint.minLength}.`;
        DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
        return;
      } else if (digitalTwinNode.constraint.maxLength && value.length > digitalTwinNode.constraint.maxLength) {
        message = `${DiagnosticMessage.LongerThanMaxLength} ${digitalTwinNode.constraint.maxLength}.`;
        DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
        return;
      } else if (digitalTwinNode.constraint.pattern) {
        const regex = new RegExp(digitalTwinNode.constraint.pattern);
        if (!regex.test(value)) {
          message = `${DiagnosticMessage.NotMatchPattern} ${digitalTwinNode.constraint.pattern}.`;
          DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
          return;
        }
      }
    }
  }

  /**
   * validate enum node
   * @param version target version
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static validateEnumNode(
    version: number,
    jsonNode: parser.Node,
    digitalTwinNode: PropertyNode,
    problems: Problem[]
  ): void {
    const enums: string[] = IntelliSenseUtility.getEnums(digitalTwinNode, version);
    if (!enums.length) {
      DigitalTwinDiagnosticProvider.addProblemOfInvalidType(jsonNode, digitalTwinNode, problems);
    } else if (!enums.includes(jsonNode.value as string)) {
      const message: string = [DiagnosticMessage.InvalidEnum, ...enums].join(Constants.LINE_FEED);
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
    }
    enums.length = 0;
  }

  /**
   * validate json number node
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static validateNumberNode(jsonNode: parser.Node, digitalTwinNode: PropertyNode, problems: Problem[]): void {
    const classNode: ClassNode | undefined = DigitalTwinDiagnosticProvider.findClassNode(
      digitalTwinNode,
      ValueSchema.Int
    );
    // validate number is integer
    if (!classNode || !Number.isInteger(jsonNode.value as number)) {
      DigitalTwinDiagnosticProvider.addProblemOfInvalidType(jsonNode, digitalTwinNode, problems);
      return;
    }
  }

  /**
   * validate boolean node
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static validateBooleanNode(jsonNode: parser.Node, digitalTwinNode: PropertyNode, problems: Problem[]): void {
    const classNode: ClassNode | undefined = DigitalTwinDiagnosticProvider.findClassNode(
      digitalTwinNode,
      ValueSchema.Boolean
    );
    if (!classNode) {
      DigitalTwinDiagnosticProvider.addProblemOfInvalidType(jsonNode, digitalTwinNode, problems);
      return;
    }
  }

  /**
   * validate language node
   * @param version target version
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static validateLanguageNode(
    version: number,
    jsonNode: parser.Node,
    digitalTwinNode: PropertyNode,
    problems: Problem[]
  ): void {
    if (!jsonNode.children) {
      return;
    }
    let propertyName: string;
    let propertyPair: PropertyPair | undefined;
    for (const child of jsonNode.children) {
      propertyPair = IntelliSenseUtility.parseProperty(child);
      if (!propertyPair) {
        continue;
      }
      propertyName = propertyPair.name.value as string;
      if (!LANGUAGE_CODE.has(propertyName)) {
        DigitalTwinDiagnosticProvider.addProblemOfUnexpectedProperty(propertyPair.name, problems);
      } else if (propertyPair.value.type !== JsonNodeType.String) {
        DigitalTwinDiagnosticProvider.addProblem(propertyPair.value, problems, DiagnosticMessage.ValueNotString);
      } else {
        DigitalTwinDiagnosticProvider.validateStringNode(version, propertyPair.value, digitalTwinNode, problems);
      }
    }
  }

  /**
   * update diagnostics
   * @param document text document
   * @param collection diagnostic collection
   */
  updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
    if (!IntelliSenseUtility.enabled()) {
      return;
    }
    const modelContent: ModelContent | undefined = IntelliSenseUtility.parseDigitalTwinModel(document.getText());
    if (!modelContent) {
      // clean diagnostic cache
      collection.delete(document.uri);
      return;
    }
    const diagnostics: vscode.Diagnostic[] = this.provideDiagnostics(document, modelContent);
    collection.set(document.uri, diagnostics);
  }

  /**
   * provide diagnostics
   * @param document text document
   * @param modelContent model content
   */
  private provideDiagnostics(document: vscode.TextDocument, modelContent: ModelContent): vscode.Diagnostic[] {
    let diagnostics: vscode.Diagnostic[] = [];
    const digitalTwinNode: PropertyNode | undefined = IntelliSenseUtility.getEntryNode();
    if (!digitalTwinNode) {
      return diagnostics;
    }
    const problems: Problem[] = [];
    DigitalTwinDiagnosticProvider.validateNode(modelContent.version, modelContent.jsonNode, digitalTwinNode, problems);
    diagnostics = problems.map(
      p =>
        new vscode.Diagnostic(
          new vscode.Range(document.positionAt(p.offset), document.positionAt(p.offset + p.length)),
          p.message,
          vscode.DiagnosticSeverity.Error
        )
    );
    // clear problem collection
    problems.length = 0;
    return diagnostics;
  }
}
