// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as parser from "jsonc-parser";
import * as vscode from "vscode";
import { DigitalTwinConstants } from "./digitalTwinConstants";
import { ClassNode, DigitalTwinGraph, PropertyNode } from "./digitalTwinGraph";

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
    return IntelliSenseUtility.graph.getPropertyNode(
      DigitalTwinConstants.ENTRY_NODE
    );
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
   * parse the text, return json node if it is DigitalTwin model
   * @param text text
   */
  static parseDigitalTwinModel(text: string): parser.Node | undefined {
    // skip checking errors in order to do IntelliSense at best effort
    const jsonNode: parser.Node = parser.parseTree(text);
    const contextPath: string[] = [DigitalTwinConstants.CONTEXT];
    const contextNode: parser.Node | undefined = parser.findNodeAtLocation(
      jsonNode,
      contextPath
    );
    if (contextNode && IntelliSenseUtility.isDigitalTwinContext(contextNode)) {
      return jsonNode;
    }
    return undefined;
  }

  /**
   * check if json node has DigitalTwin context
   * @param node json node
   */
  static isDigitalTwinContext(node: parser.Node): boolean {
    // assume @context is string node
    if (node.type === JsonNodeType.String) {
      return DigitalTwinConstants.CONTEXT_REGEX.test(node.value as string);
    }
    return false;
  }

  /**
   * check if it is language node
   * @param classNode class node
   */
  static isLanguageNode(classNode: ClassNode): boolean {
    return classNode.id === DigitalTwinConstants.LANGUAGE;
  }

  /**
   * parse json node, return property pair
   * @param node json node
   */
  static parseProperty(node: parser.Node): PropertyPair | undefined {
    if (
      node.type !== JsonNodeType.Property ||
      !node.children ||
      node.children.length !== 2
    ) {
      return undefined;
    }
    return { name: node.children[0], value: node.children[1] };
  }

  /**
   * get the range of json node
   * @param document text document
   * @param node json node
   */
  static getNodeRange(
    document: vscode.TextDocument,
    node: parser.Node
  ): vscode.Range {
    return new vscode.Range(
      document.positionAt(node.offset),
      document.positionAt(node.offset + node.length)
    );
  }

  /**
   * get enums from property range
   * @param propertyNode property node
   */
  static getEnums(propertyNode: PropertyNode): string[] {
    const enums: string[] = [];
    if (!propertyNode.range) {
      return enums;
    }
    for (const classNode of propertyNode.range) {
      if (classNode.enums) {
        enums.push(...classNode.enums);
      } else if (classNode.isAbstract && classNode.children) {
        for (const child of classNode.children) {
          if (child.enums) {
            enums.push(...child.enums);
          }
        }
      }
    }
    return enums;
  }

  /**
   * get object classes from property range
   * @param propertyNode property node
   */
  static getObjectClasses(propertyNode: PropertyNode): ClassNode[] {
    const classes: ClassNode[] = [];
    if (!propertyNode.range) {
      return classes;
    }
    for (const classNode of propertyNode.range) {
      if (DigitalTwinGraph.isObjectClass(classNode)) {
        classes.push(classNode);
      } else if (classNode.isAbstract && classNode.children) {
        for (const child of classNode.children) {
          if (!child.enums) {
            classes.push(child);
          }
        }
      }
    }
    return classes;
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
    let node: parser.Node = propertyPair.name;
    // get outer object node
    if (node.parent && node.parent.parent) {
      node = node.parent.parent;
      const outPropertyPair:
        | PropertyPair
        | undefined = IntelliSenseUtility.getOuterPropertyPair(node);
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
    return outerProperty
      ? IntelliSenseUtility.parseProperty(outerProperty)
      : undefined;
  }

  private static graph: DigitalTwinGraph;
  private constructor() {}
}
