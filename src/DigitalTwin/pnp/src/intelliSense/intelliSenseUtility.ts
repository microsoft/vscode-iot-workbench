// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as parser from "jsonc-parser";
import * as vscode from "vscode";
import { DigitalTwinConstants } from "./digitalTwinConstants";
import { ClassNode, DigitalTwinGraph, PropertyNode, VersionNode } from "./digitalTwinGraph";

/**
 * Type of json node
 */
export enum JsonNodeType {
  Object = "object",
  Array = "array",
  String = "string",
  Number = "number",
  Boolean = "boolean",
  Property = "property"
}

/**
 * DigitalTwin model content
 */
export interface ModelContent {
  jsonNode: parser.Node;
  version: number;
}

/**
 * Property pair includes name and value
 */
export interface PropertyPair {
  name: parser.Node;
  value: parser.Node;
}

/**
 * Utility for IntelliSense
 */
export class IntelliSenseUtility {
  /**
   * init DigitalTwin graph
   * @param context extension context
   */
  static async initGraph(context: vscode.ExtensionContext): Promise<void> {
    IntelliSenseUtility.graph = await DigitalTwinGraph.getInstance(context);
  }

  /**
   * check if IntelliSense has been enabled
   */
  static enabled(): boolean {
    return IntelliSenseUtility.graph && IntelliSenseUtility.graph.initialized();
  }

  /**
   * get entry node of DigitalTwin model
   */
  static getEntryNode(): PropertyNode | undefined {
    return IntelliSenseUtility.graph.getPropertyNode(DigitalTwinConstants.ENTRY_NODE);
  }

  /**
   * get property node of DigitalTwin model by name
   * @param name property name
   */
  static getPropertyNode(name: string): PropertyNode | undefined {
    return IntelliSenseUtility.graph.getPropertyNode(name);
  }

  /**
   * get class node of DigitalTwin model by name
   * @param name class name
   */
  static getClasNode(name: string): ClassNode | undefined {
    return IntelliSenseUtility.graph.getClassNode(name);
  }

  /**
   * get class type of class node
   * @param classNode class node
   */
  static getClassType(classNode: ClassNode): string {
    return classNode.label || classNode.id;
  }

  /**
   * get valid type names
   * @param propertyNode property node
   */
  static getValidTypes(propertyNode: PropertyNode): string[] {
    if (!propertyNode.range) {
      return [];
    }
    return propertyNode.range.map(classNode => {
      if (classNode.label) {
        return classNode.label;
      } else {
        // get the name of XMLSchema
        const index: number = classNode.id.lastIndexOf(DigitalTwinConstants.SCHEMA_SEPARATOR);
        return index === -1 ? classNode.id : classNode.id.slice(index + 1);
      }
    });
  }

  /**
   * parse the text, return DigitalTwin model content
   * @param text text
   */
  static parseDigitalTwinModel(text: string): ModelContent | undefined {
    // skip checking errors in order to do IntelliSense at best effort
    const jsonNode: parser.Node = parser.parseTree(text);
    const contextPath: string[] = [DigitalTwinConstants.CONTEXT];
    const contextNode: parser.Node | undefined = parser.findNodeAtLocation(jsonNode, contextPath);
    if (!contextNode) {
      return undefined;
    }
    const version = IntelliSenseUtility.getDigitalTwinVersion(contextNode);
    if (!version) {
      return undefined;
    }
    return { jsonNode, version };
  }

  /**
   * get the version of DigitalTwin definition,
   * return 0 if it has no DigitalTwin context
   * @param node json node
   */
  static getDigitalTwinVersion(node: parser.Node): number {
    if (!IntelliSenseUtility.graph) {
      return 0;
    }
    // @context accept both array and string
    if (node.type === JsonNodeType.String) {
      return IntelliSenseUtility.graph.getVersion(node.value as string);
    } else if (node.type === JsonNodeType.Array && node.children) {
      for (const child of node.children) {
        if (child.type !== JsonNodeType.String) {
          return 0;
        }
        const version: number = IntelliSenseUtility.graph.getVersion(child.value as string);
        if (version) {
          return version;
        }
      }
    }
    return 0;
  }

  /**
   * check if name is a reserved name
   * @param name name
   */
  static isReservedName(name: string): boolean {
    return name.startsWith(DigitalTwinConstants.RESERVED);
  }

  /**
   * check if it is language node
   * @param classNode class node
   */
  static isLanguageNode(classNode: ClassNode): boolean {
    return classNode.id === DigitalTwinConstants.LANGUAGE;
  }

  /**
   * check if class node is a object class,
   * which is not one of the following
   * 1. abstract class
   * 2. enum
   * 3. value schema
   * @param classNode class node
   */
  static isObjectClass(classNode: ClassNode): boolean {
    if (classNode.isAbstract || classNode.enums || !classNode.label) {
      return false;
    }
    return true;
  }

  /**
   * parse json node, return property pair
   * @param node json node
   */
  static parseProperty(node: parser.Node): PropertyPair | undefined {
    if (node.type !== JsonNodeType.Property || !node.children || node.children.length !== 2) {
      return undefined;
    }
    return { name: node.children[0], value: node.children[1] };
  }

  /**
   * get the range of json node
   * @param document text document
   * @param node json node
   */
  static getNodeRange(document: vscode.TextDocument, node: parser.Node): vscode.Range {
    return new vscode.Range(document.positionAt(node.offset), document.positionAt(node.offset + node.length));
  }

  /**
   * get enums by version
   * @param propertyNode property node
   * @param version target version
   */
  static getEnums(propertyNode: PropertyNode, version: number): string[] {
    const enums: string[] = [];
    for (const classNode of IntelliSenseUtility.getRangeOfPropertyByVersion(propertyNode, version)) {
      // assume enum node can have different version,
      // but all enum value of one enum node share the same version
      if (classNode.enums) {
        enums.push(...classNode.enums);
      } else if (classNode.isAbstract) {
        for (const child of IntelliSenseUtility.getChildrenOfClassByVersion(classNode, version)) {
          if (child.enums) {
            enums.push(...child.enums);
          }
        }
      }
    }
    return enums;
  }

  /**
   * get object classes by version
   * @param propertyNode property node
   * @param version target version
   */
  static getObjectClasses(propertyNode: PropertyNode, version: number): ClassNode[] {
    const classes: ClassNode[] = [];
    for (const classNode of IntelliSenseUtility.getRangeOfPropertyByVersion(propertyNode, version)) {
      if (IntelliSenseUtility.isObjectClass(classNode)) {
        classes.push(classNode);
      } else if (classNode.isAbstract) {
        for (const child of IntelliSenseUtility.getChildrenOfClassByVersion(classNode, version)) {
          if (!child.enums) {
            classes.push(child);
          }
        }
      }
    }
    return classes;
  }

  /**
   * get range of property node by version
   * @param propertyNode property node
   * @param version target version
   */
  static getRangeOfPropertyByVersion(propertyNode: PropertyNode, version: number): ClassNode[] {
    if (!propertyNode.range) {
      return [];
    }
    return propertyNode.range.filter(node => IntelliSenseUtility.isAvailableByVersion(version, node.version));
  }

  /**
   * get children of class node by version
   * @param classNode class node
   * @param version target version
   */
  static getChildrenOfClassByVersion(classNode: ClassNode, version: number): ClassNode[] {
    if (!classNode.children) {
      return [];
    }
    return classNode.children.filter(node => IntelliSenseUtility.isAvailableByVersion(version, node.version));
  }

  /**
   * get properties of class node by version
   * @param classNode class node
   * @param version target version
   */
  static getPropertiesOfClassByVersion(classNode: ClassNode, version: number): ClassNode[] {
    if (!classNode.properties) {
      return [];
    }
    return classNode.properties.filter(node => IntelliSenseUtility.isAvailableByVersion(version, node.version));
  }

  /**
   * check if node is available by version
   * @param version target version
   * @param versionNode version node
   */
  static isAvailableByVersion(version: number, versionNode: VersionNode | undefined): boolean {
    if (!versionNode) {
      return true;
    }
    // assume definition is not allowed to be re-included
    if (versionNode.includeSince && versionNode.includeSince > version) {
      return false;
    }
    if (versionNode.excludeSince && versionNode.excludeSince <= version) {
      return false;
    }
    return true;
  }

  /**
   * resolve property name for schema and interfaceSchema
   * @param propertyPair property pair
   */
  static resolvePropertyName(propertyPair: PropertyPair): string {
    let propertyName: string = propertyPair.name.value as string;
    if (propertyName !== DigitalTwinConstants.SCHEMA) {
      return propertyName;
    }
    const node: parser.Node = propertyPair.name;
    // get outer object node
    if (node.parent && node.parent.parent) {
      const outPropertyPair: PropertyPair | undefined = IntelliSenseUtility.getOuterPropertyPair(node.parent.parent);
      if (outPropertyPair) {
        const name: string = outPropertyPair.name.value as string;
        if (name === DigitalTwinConstants.IMPLEMENTS) {
          propertyName = DigitalTwinConstants.INTERFACE_SCHEMA;
        }
      }
    }
    return propertyName;
  }

  /**
   * get outer property pair from current node
   * @param node json node
   */
  static getOuterPropertyPair(node: parser.Node): PropertyPair | undefined {
    if (node.type !== JsonNodeType.Object) {
      return undefined;
    }
    let outerProperty: parser.Node | undefined = node.parent;
    if (outerProperty && outerProperty.type === JsonNodeType.Array) {
      outerProperty = outerProperty.parent;
    }
    return outerProperty ? IntelliSenseUtility.parseProperty(outerProperty) : undefined;
  }

  private static graph: DigitalTwinGraph;
  private constructor() {}
}
