// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

/**
 * Message for diagnostic result
 */
export enum DiagnosticMessage {
  MissingType = "@type is missing.",
  InvalidType = "Invalid type. Valid types:",
  UnexpectedProperty = "is unexpected.",
  MissingRequiredProperties = "Missing required properties:",
  ShorterThanMinLength = "String is shorter than the minimum length of",
  LongerThanMaxLength = "String is longer than the maximum length of",
  NotMatchPattern = "String does not match the pattern of",
  NotObjectType = "Object is not expected.",
  EmptyObject = "Object is empty.",
  EmptyString = "String is empty.",
  EmptyArray = "Array is empty.",
  TooFewItems = "Array has too few items. Minimum count is",
  TooManyItems = "Array has too many items. Maximum count is",
  DuplicateItem = "has been assigned to another item.",
  InvalidEnum = "Invalid value. Valid values:",
  InvalidContext = "Invalid context of DigitalTwin.",
  ConflictType = "Conflict type:",
  ValueNotString = "Value is not string."
}

/**
 * Constants for DigitalTwin IntelliSense
 */
export class DigitalTwinConstants {
  static readonly SCHEMA_SEPARATOR = "#";
  static readonly BASE_CLASS = "Entity";
  static readonly NAME = "name";
  static readonly SCHEMA = "schema";
  static readonly CONTENTS = "contents";
  static readonly IMPLEMENTS = "implements";
  static readonly INTERFACE_SCHEMA = "interfaceSchema";
  static readonly RESERVED = "@";
  static readonly CONTEXT = "@context";
  static readonly VOCABULARY = "@vocab";
  static readonly ID = "@id";
  static readonly TYPE = "@type";
  static readonly CONTAINER = "@container";
  static readonly LIST = "@list";
  static readonly SET = "@set";
  static readonly LANGUAGE = "@language";
  static readonly ENTRY_NODE = "@entry";
  static readonly DUMMY_NODE = "@dummy";
  static readonly INTERFACE_NODE = "Interface";
  static readonly CAPABILITY_MODEL_NODE = "CapabilityModel";
  static readonly SCHEMA_NODE = "Schema";
  static readonly UNIT_NODE = "Unit";
  static readonly INTERFACE_SCHEMA_NODE = "InterfaceInstance/schema";
  static readonly WORD_STOP = ' \t\n\r\v":{[,';
  static readonly REQUIRED_PROPERTY_LABEL = "(required)";
  static readonly IOT_MODEL_LABEL = "IoTModel";
  static readonly CONTEXT_TEMPLATE = "http://azureiot.com/v1/contexts/IoTModel.json";
  static readonly SUPPORT_SEMANTIC_TYPES = new Set<string>(["Telemetry", "Property"]);
}
