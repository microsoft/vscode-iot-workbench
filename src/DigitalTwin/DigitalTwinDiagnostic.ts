import * as vscode from 'vscode';

import {DigitalTwinMetaModelParser} from './DigitalTwinMetaModelGraph';
import * as Json from './JSON';

import uniq = require('lodash.uniq');
import {DigitalTwinMetaModelContext} from './DigitalTwinMetaModelUtility';

export interface Issue {
  startIndex: number;
  endIndex: number;
  message: string;
}

export class DigitalTwinDiagnostic {
  private _diagnosticCollection =
      vscode.languages.createDiagnosticCollection('dtmetamodel');
  private _diagnostics: vscode.Diagnostic[] = [];

  private _isValidStringValue(
      value: string, range: string[], caseInsensitive: boolean) {
    value = caseInsensitive ? value.toLowerCase() : value;
    for (let testValue of range) {
      testValue = caseInsensitive ? testValue.toLowerCase() : testValue;
      if (testValue === value) {
        return true;
      }
    }
    return false;
  }

  constructor(
      private _dtParser: DigitalTwinMetaModelParser,
      private dtInterface: DigitalTwinMetaModelContext,
      private dtCapabilityModel: DigitalTwinMetaModelContext) {}

  getIssues(
      dtContext: DigitalTwinMetaModelContext,
      document: vscode.TextDocument): Issue[] {
    const text = document.getText();
    const json = Json.parse(text);
    if (!json || !json.value) {
      return [];
    }
    let issues = this.getJsonValueIssues(dtContext, document, json.value);
    issues = issues.concat(this.getTypeIssues(dtContext, document, json.value));

    return issues;
  }

  getJsonValueIssues(
      dtContext: DigitalTwinMetaModelContext, document: vscode.TextDocument,
      jsonValue: Json.Value, jsonKey?: string) {
    switch (jsonValue.valueKind) {
      case Json.ValueKind.ObjectValue:
        return this.getObjectIssues(
            dtContext, document, jsonValue as Json.ObjectValue, jsonKey);
      case Json.ValueKind.ArrayValue:
        let issues: Issue[] = [];
        const arrayIssues = this.getArrayIssues(
            dtContext, document, jsonValue as Json.ArrayValue, jsonKey);
        const arrayElementNameIssues =
            this.getArrayElementNameIssues(jsonValue as Json.ArrayValue);
        issues = issues.concat(arrayIssues, arrayElementNameIssues);
        return issues;
      case Json.ValueKind.StringValue:
        return this.getStringIssues(
            dtContext, document, jsonValue as Json.StringValue, jsonKey);
      default:
        return [];
    }
  }

  getType(
      dtContext: DigitalTwinMetaModelContext, document: vscode.TextDocument,
      jsonValue: Json.ObjectValue, jsonKey?: string) {
    if (jsonValue.hasProperty('@type')) {
      const typeValue = jsonValue.getPropertyValue('@type');
      if (typeValue.valueKind === Json.ValueKind.StringValue) {
        return typeValue.toFriendlyString();
      } else if (typeValue.valueKind === Json.ValueKind.ArrayValue) {
        const types: string[] = [];
        for (const typeObject of (typeValue as Json.ArrayValue).elements) {
          types.push(typeObject.toFriendlyString());
        }
        return types;
      }
    }

    let types: string[];
    if (jsonKey) {
      const id = this._dtParser.getIdFromShortName(dtContext, jsonKey);
      if (!id) {
        return null;
      }
      types = this._dtParser.getTypesFromId(dtContext, id);
    } else {
      const documentType = /\.interface\.json$/.test(document.uri.fsPath) ?
          'Interface' :
          'CapabilityModel';
      types = [documentType];
    }

    if (types.length === 1) {
      return types[0];
    }

    return null;
  }

  getStringIssues(
      dtContext: DigitalTwinMetaModelContext, document: vscode.TextDocument,
      jsonValue: Json.StringValue, jsonKey?: string) {
    if (!jsonKey) {
      return [];
    }
    let values: string[] = [];
    let caseInsensitive = false;
    if (jsonKey === '@context') {
      caseInsensitive = true;
      const contextUri = this.dtInterface === dtContext ?
          'http://azureiot.com/v0/contexts/Interface.json' :
          'http://azureiot.com/v0/contexts/CapabilityModel.json';
      values = [contextUri];
    } else {
      values = this._dtParser.getStringValuesFromShortName(dtContext, jsonKey);
    }

    if (!values.length) {
      return [];
    }

    if (values.indexOf('XMLSchema#string') !== -1) {
      return this.getStringPatternIssues(document, jsonValue, jsonKey);
    } else if (!this._isValidStringValue(
                   jsonValue.toFriendlyString(), values, caseInsensitive)) {
      const startIndex = jsonValue.span.startIndex;
      const endIndex = jsonValue.span.endIndex;
      const message = `Invalid value. Valid values:\n${values.join('\n')}`;
      const issue: Issue = {startIndex, endIndex, message};

      return [issue];
    }

    return [];
  }

  getStringPatternIssues(
      document: vscode.TextDocument, jsonValue: Json.StringValue,
      jsonKey: string) {
    const pattern = this._dtParser.getStringValuePattern(jsonKey);
    if (pattern) {
      if (!pattern.test(jsonValue.toFriendlyString())) {
        const startIndex = jsonValue.span.startIndex;
        const endIndex = jsonValue.span.endIndex;
        const message =
            `Invalid value. Valid value must match this regular expression ${
                pattern.toString()}`;
        const issue: Issue = {startIndex, endIndex, message};
        return [issue];
      }
    }
    return [];
  }

  getArrayIssues(
      dtContext: DigitalTwinMetaModelContext, document: vscode.TextDocument,
      jsonValue: Json.ArrayValue, jsonKey?: string) {
    let issues: Issue[] = [];
    for (const elementValue of jsonValue.elements) {
      const elementIssues =
          this.getJsonValueIssues(dtContext, document, elementValue, jsonKey);
      issues = issues.concat(elementIssues);
    }
    return issues;
  }

  getArrayElementNameIssues(jsonValue: Json.ArrayValue) {
    const issues: Issue[] = [];
    const names: string[] = [];
    for (const elementValue of jsonValue.elements) {
      if (elementValue.valueKind === Json.ValueKind.ObjectValue) {
        if ((elementValue as Json.ObjectValue).hasProperty('name')) {
          const nameValue =
              (elementValue as Json.ObjectValue).getPropertyValue('name');
          if (nameValue.valueKind === Json.ValueKind.StringValue) {
            const name = (nameValue as Json.StringValue).toFriendlyString();
            if (names.indexOf(name) !== -1) {
              const startIndex = nameValue.span.startIndex;
              const endIndex = nameValue.span.endIndex;
              const message =
                  `${name} has already been assigned to another item.`;
              const issue: Issue = {startIndex, endIndex, message};
              issues.push(issue);
            } else {
              names.push(name);
            }
          }
        }
      }
    }
    return issues;
  }

  getObjectIssues(
      dtContext: DigitalTwinMetaModelContext, document: vscode.TextDocument,
      jsonValue: Json.ObjectValue, jsonKey?: string) {
    let issues: Issue[] = [];
    const typeIssues =
        this.getInvalidTypeIssues(dtContext, document, jsonValue, jsonKey);
    if (typeIssues) {
      return typeIssues;
    }

    const type = this.getType(dtContext, document, jsonValue, jsonKey);
    if (!type) {
      const startIndex = jsonValue.span.startIndex;
      const endIndex = jsonValue.span.endIndex;
      const message = '@type is missing';
      const issue: Issue = {startIndex, endIndex, message};
      issues.push(issue);
      return issues;
    }

    if (type === 'Interface') {
      dtContext = this.dtInterface;
    }
    if (type === 'CapabilityModel') {
      dtContext = this.dtCapabilityModel;
    }

    if (Array.isArray(type)) {
      for (const currentType of type) {
        const missingRequiredPropertiesIssues =
            this.getMissingRequiredPropertiesIssues(jsonValue, currentType);
        issues = issues.concat(missingRequiredPropertiesIssues);
      }
    } else {
      const missingRequiredPropertiesIssues =
          this.getMissingRequiredPropertiesIssues(jsonValue, type);
      issues = issues.concat(missingRequiredPropertiesIssues);
    }

    const unexpectedPropertiesIssues =
        this.getUnexpectedPropertiesIssues(dtContext, jsonValue, type);
    if (unexpectedPropertiesIssues.length) {
      issues = issues.concat(unexpectedPropertiesIssues);
    }

    for (const propertyName of jsonValue.propertyNames) {
      const childIssues = this.getJsonValueIssues(
          dtContext, document, jsonValue.getPropertyValue(propertyName),
          propertyName);
      issues = issues.concat(childIssues);
    }

    return issues;
  }

  getTypeIssues(
      dtContext: DigitalTwinMetaModelContext, document: vscode.TextDocument,
      jsonValue: Json.Value, jsonKey?: string, isArrayElement = false) {
    console.log(`checking ${jsonKey} kind, isArrayElement: ${isArrayElement}`);
    const validTypes: Json.ValueKind[] = [];
    let issues: Issue[] = [];
    let rawValueTypes: string[] = [];
    if (!jsonKey) {
      rawValueTypes = ['object'];
      validTypes.push(Json.ValueKind.ObjectValue);
    } else if (
        !isArrayElement && this._dtParser.isArrayFromShortName(jsonKey)) {
      rawValueTypes = ['array'];
      validTypes.push(Json.ValueKind.ArrayValue);
    } else {
      const id = this._dtParser.getIdFromShortName(dtContext, jsonKey);
      if (!id) {
        return [];
      }
      rawValueTypes = this._dtParser.getValueTypesFromId(id);
      rawValueTypes.forEach(valueType => {
        switch (valueType) {
          case 'string':
            validTypes.push(Json.ValueKind.StringValue);
            break;
          case 'int':
          case 'long':
          case 'float':
          case 'double':
            validTypes.push(Json.ValueKind.NumberValue);
            break;
          case 'boolean':
            validTypes.push(Json.ValueKind.BooleanValue);
            break;
          default:
            break;
        }
      });
      if (!validTypes.length) {
        validTypes.push(Json.ValueKind.ObjectValue, Json.ValueKind.StringValue);
      }
    }

    console.log(`${jsonKey} has types of ${rawValueTypes.join(',')}`);

    if (validTypes.indexOf(jsonValue.valueKind) === -1) {
      const startIndex = jsonValue.span.startIndex;
      const endIndex = jsonValue.span.endIndex;
      const message = `Unexpected value. Expect ${rawValueTypes.join(', ')}.`;
      const issue: Issue = {startIndex, endIndex, message};
      issues.push(issue);
    }

    if (issues.length) {
      return issues;
    }

    if (jsonValue.valueKind === Json.ValueKind.ArrayValue) {
      for (const element of (jsonValue as Json.ArrayValue).elements) {
        issues = issues.concat(
            this.getTypeIssues(dtContext, document, element, jsonKey, true));
      }
    } else if (jsonValue.valueKind === Json.ValueKind.ObjectValue) {
      for (const key of (jsonValue as Json.ObjectValue).propertyNames) {
        const value = (jsonValue as Json.ObjectValue).getPropertyValue(key);
        issues =
            issues.concat(this.getTypeIssues(dtContext, document, value, key));
      }
    } else if (
        jsonValue.valueKind === Json.ValueKind.NumberValue &&
        rawValueTypes.indexOf('float') === -1 &&
        rawValueTypes.indexOf('double') === -1) {
      const value = Number((jsonValue as Json.NumberValue).toFriendlyString());
      if (Math.floor(value) !== value) {
        const startIndex = jsonValue.span.startIndex;
        const endIndex = jsonValue.span.endIndex;
        const message =
            `Invalid value. Valid value is ${rawValueTypes.join(', ')}.`;
        const issue: Issue = {startIndex, endIndex, message};
        issues.push(issue);
      }
    }

    return issues;
  }

  getInvalidTypeIssues(
      dtContext: DigitalTwinMetaModelContext, document: vscode.TextDocument,
      jsonValue: Json.ObjectValue, jsonKey?: string) {
    let types: string[];
    if (jsonKey) {
      const id = this._dtParser.getIdFromShortName(dtContext, jsonKey);
      if (!id) {
        return null;
      }
      types = this._dtParser.getTypesFromId(dtContext, id);
    } else {
      const documentType = /\.interface\.json$/.test(document.uri.fsPath) ?
          'Interface' :
          'CapabilityModel';
      types = [documentType];
    }

    const type = this.getType(dtContext, document, jsonValue, jsonKey);
    if (typeof type === 'string' && types.indexOf(type) === -1) {
      const typeValue = jsonValue.getPropertyValue('@type') as Json.StringValue;
      const startIndex = typeValue.span.startIndex;
      const endIndex = typeValue.span.endIndex;
      const message = `Invalid type. Valid types:\n${types.join('\n')}`;
      const issue: Issue = {startIndex, endIndex, message};
      return [issue];
    } else if (Array.isArray(type)) {
      const typeValue = jsonValue.getPropertyValue('@type') as Json.ArrayValue;
      const issues: Issue[] = [];
      for (let index = 0; index < type.length; index++) {
        const currentType = type[index];
        const currentTypeObject = typeValue.elements[index] as Json.StringValue;
        const startIndex = currentTypeObject.span.startIndex;
        const endIndex = currentTypeObject.span.endIndex;
        if (types.indexOf(currentType) === -1) {
          issues.push({
            startIndex,
            endIndex,
            message: `Invalid type. Valid types:\n${types.join('\n')}`
          });
        } else if (type.indexOf(currentType) !== index) {
          issues.push({
            startIndex,
            endIndex,
            message: `${currentType} has already been added before.`
          });
        }
      }
      if (issues.length) {
        return issues;
      }
    }

    return null;
  }

  getMissingRequiredPropertiesIssues(
      jsonValue: Json.ObjectValue, type: string) {
    const issues: Issue[] = [];
    const missingRequiredProperties: string[] = [];
    const requiredProperties =
        this._dtParser.getRequiredPropertiesFromType(type);
    for (const requiredProperty of requiredProperties) {
      if (!jsonValue.hasProperty(requiredProperty)) {
        missingRequiredProperties.push(requiredProperty);
      }
    }
    if (missingRequiredProperties.length) {
      const startIndex = jsonValue.span.startIndex;
      const endIndex = jsonValue.span.startIndex;
      const message = `Missing required properties:\n${
          missingRequiredProperties.join('\n')}`;
      const issue = {startIndex, endIndex, message};
      issues.push(issue);
    }

    // Required property cannot be an empty array
    for (const propertyName of jsonValue.propertyNames) {
      if (requiredProperties.indexOf(propertyName) === -1) {
        continue;
      }

      const propertyValue = jsonValue.getPropertyValue(propertyName);
      if (propertyValue.valueKind !== Json.ValueKind.ArrayValue) {
        continue;
      }

      if ((propertyValue as Json.ArrayValue).elements.length === 0) {
        const startIndex = propertyValue.span.startIndex;
        const endIndex = propertyValue.span.startIndex;
        const message = `${propertyName} cannot be empty.`;
        const issue: Issue = {startIndex, endIndex, message};
        issues.push(issue);
      }
    }
    return issues;
  }

  getUnexpectedPropertiesIssues(
      dtContext: DigitalTwinMetaModelContext, jsonValue: Json.ObjectValue,
      type: string|string[]) {
    let properties: string[] = [];
    if (Array.isArray(type)) {
      for (const currentType of type) {
        const currentProperties =
            this._dtParser.getTypedPropertiesFromType(dtContext, currentType)
                .map(property => property.label);
        properties = properties.concat(
            currentProperties,
            this._dtParser.getRequiredPropertiesFromType(currentType));
      }
    } else {
      properties = this._dtParser.getTypedPropertiesFromType(dtContext, type)
                       .map(property => property.label);
      properties =
          properties.concat(this._dtParser.getRequiredPropertiesFromType(type));
    }
    properties = uniq(properties);
    const issues: Issue[] = [];

    for (let i = 0; i < jsonValue.propertyNames.length; i++) {
      const property = jsonValue.propertyNames[i];
      if (properties.indexOf(property) === -1) {
        const startIndex = jsonValue.properties[i].name.span.startIndex;
        const endIndex = jsonValue.properties[i].name.span.endIndex;
        const message = `${property} is unexpected.`;
        const issue: Issue = {startIndex, endIndex, message};
        issues.push(issue);
      }
    }

    return issues;
  }

  update(
      dtContext: DigitalTwinMetaModelContext, document: vscode.TextDocument) {
    const issues = this.getIssues(dtContext, document);
    for (const issue of issues) {
      const startPosition = document.positionAt(issue.startIndex);
      const endPosition = document.positionAt(issue.endIndex + 1);
      const range = new vscode.Range(startPosition, endPosition);
      const diagnostic = new vscode.Diagnostic(
          range, issue.message, vscode.DiagnosticSeverity.Warning);
      this._diagnostics.push(diagnostic);
    }
    this._diagnosticCollection.set(document.uri, this._diagnostics);
    this._diagnostics = [];
  }

  delete(document: vscode.TextDocument) {
    this._diagnosticCollection.delete(document.uri);
  }
}