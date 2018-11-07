import * as vscode from 'vscode';

import * as Json from './JSON';
import {PnPMetaModelParser} from './PnPMetaModelGraph';

import uniq = require('lodash.uniq');
import {PnPMetaModelContext} from './PnPMetaModelUtility';

export interface Issue {
  startIndex: number;
  endIndex: number;
  message: string;
}

export class PnPDiagnostic {
  private _diagnosticCollection =
      vscode.languages.createDiagnosticCollection('pnpmetamodel');
  private _diagnostics: vscode.Diagnostic[] = [];

  constructor(
      private _pnpParser: PnPMetaModelParser,
      private pnpInterface: PnPMetaModelContext,
      private pnpTemplate: PnPMetaModelContext) {}

  getIssues(pnpContext: PnPMetaModelContext, document: vscode.TextDocument):
      Issue[] {
    const text = document.getText();
    const json = Json.parse(text);
    let issues = this.getJsonValueIssues(pnpContext, document, json.value);
    issues =
        issues.concat(this.getTypeIssues(pnpContext, document, json.value));

    return issues;
  }

  getJsonValueIssues(
      pnpContext: PnPMetaModelContext, document: vscode.TextDocument,
      jsonValue: Json.Value, jsonKey?: string) {
    switch (jsonValue.valueKind) {
      case Json.ValueKind.ObjectValue:
        return this.getObjectIssues(
            pnpContext, document, jsonValue as Json.ObjectValue, jsonKey);
      case Json.ValueKind.ArrayValue:
        let issues: Issue[] = [];
        const arrayIssues = this.getArrayIssues(
            pnpContext, document, jsonValue as Json.ArrayValue, jsonKey);
        const arrayElementNameIssues =
            this.getArrayElementNameIssues(jsonValue as Json.ArrayValue);
        issues = issues.concat(arrayIssues, arrayElementNameIssues);
        return issues;
      case Json.ValueKind.StringValue:
        return this.getStringIssues(
            pnpContext, document, jsonValue as Json.StringValue, jsonKey);
      default:
        return [];
    }
  }

  getType(
      pnpContext: PnPMetaModelContext, document: vscode.TextDocument,
      jsonValue: Json.ObjectValue, jsonKey?: string) {
    if (jsonValue.hasProperty('@type')) {
      return jsonValue.getPropertyValue('@type').toFriendlyString();
    }

    let types: string[];
    if (jsonKey) {
      const id = this._pnpParser.getIdFromShortName(pnpContext, jsonKey);
      if (!id) {
        return null;
      }
      types = this._pnpParser.getTypesFromId(pnpContext, id);
    } else {
      const documentType = /\.interface\.json$/.test(document.uri.fsPath) ?
          'Interface' :
          'Template';
      types = [documentType];
    }

    if (types.length === 1) {
      return types[0];
    }

    return null;
  }

  getStringIssues(
      pnpContext: PnPMetaModelContext, document: vscode.TextDocument,
      jsonValue: Json.StringValue, jsonKey?: string) {
    if (!jsonKey) {
      return [];
    }
    let values: string[] = [];
    if (jsonKey === '@context') {
      const contextUri = this.pnpInterface === pnpContext ?
          'http://azureiot.com/v0/contexts/Interface.json' :
          'http://azureiot.com/v0/contexts/Template.json';
      values = [contextUri];
    } else {
      values =
          this._pnpParser.getStringValuesFromShortName(pnpContext, jsonKey);
    }

    if (!values.length) {
      return [];
    }

    if (values.indexOf('XMLSchema#string') !== -1) {
      return this.getStringPatternIssues(document, jsonValue, jsonKey);
    } else if (values.indexOf(jsonValue.toFriendlyString()) === -1) {
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
    const pattern = this._pnpParser.getStringValuePattern(jsonKey);
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
      pnpContext: PnPMetaModelContext, document: vscode.TextDocument,
      jsonValue: Json.ArrayValue, jsonKey?: string) {
    let issues: Issue[] = [];
    for (const elementValue of jsonValue.elements) {
      const elementIssues =
          this.getJsonValueIssues(pnpContext, document, elementValue, jsonKey);
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
      pnpContext: PnPMetaModelContext, document: vscode.TextDocument,
      jsonValue: Json.ObjectValue, jsonKey?: string) {
    let issues: Issue[] = [];
    const typeIssue =
        this.getInvalidTypeIssue(pnpContext, document, jsonValue, jsonKey);
    if (typeIssue) {
      issues.push(typeIssue);
      return issues;
    }

    const type = this.getType(pnpContext, document, jsonValue, jsonKey);
    if (!type) {
      const startIndex = jsonValue.span.startIndex;
      const endIndex = jsonValue.span.endIndex;
      const message = '@type is missing';
      const issue: Issue = {startIndex, endIndex, message};
      issues.push(issue);
      return issues;
    }

    if (type === 'Interface') {
      pnpContext = this.pnpInterface;
    }
    if (type === 'Template') {
      pnpContext = this.pnpTemplate;
    }

    const missingRequiredPropertiesIssues =
        this.getMissingRequiredPropertiesIssues(jsonValue, type);
    issues = issues.concat(missingRequiredPropertiesIssues);

    const unexpectedPropertiesIssues =
        this.getUnexpectedPropertiesIssues(pnpContext, jsonValue, type);
    if (unexpectedPropertiesIssues.length) {
      issues = issues.concat(unexpectedPropertiesIssues);
    }

    for (const propertyName of jsonValue.propertyNames) {
      const childIssues = this.getJsonValueIssues(
          pnpContext, document, jsonValue.getPropertyValue(propertyName),
          propertyName);
      issues = issues.concat(childIssues);
    }

    return issues;
  }

  getTypeIssues(
      pnpContext: PnPMetaModelContext, document: vscode.TextDocument,
      jsonValue: Json.Value, jsonKey?: string, isArrayElement = false) {
    console.log(`checking ${jsonKey} kind, isArrayElement: ${isArrayElement}`);
    let validTypes: Json.ValueKind[];
    let issues: Issue[] = [];
    let valueType = '';
    if (!jsonKey) {
      validTypes = [Json.ValueKind.ObjectValue];
    } else if (
        !isArrayElement && this._pnpParser.isArrayFromShortName(jsonKey)) {
      validTypes = [Json.ValueKind.ArrayValue];
    } else {
      const id = this._pnpParser.getIdFromShortName(pnpContext, jsonKey);
      if (!id) {
        return [];
      }
      valueType = this._pnpParser.getValueTypeFromId(id);
      switch (valueType) {
        case 'string':
          validTypes = [Json.ValueKind.StringValue];
          break;
        case 'int':
        case 'long':
        case 'float':
        case 'double':
          validTypes = [Json.ValueKind.NumberValue];
          break;
        case 'boolean':
          validTypes = [Json.ValueKind.BooleanValue];
          break;
        default:
          validTypes = [Json.ValueKind.ObjectValue, Json.ValueKind.StringValue];
      }
    }

    const validTypesFriendlyString = validTypes.map(kind => {
      switch (kind) {
        case Json.ValueKind.StringValue:
          return 'String';
        case Json.ValueKind.NumberValue:
          return 'Number';
        case Json.ValueKind.BooleanValue:
          return 'Boolean';
        case Json.ValueKind.ObjectValue:
          return 'Object';
        case Json.ValueKind.ArrayValue:
          return 'Array';
        default:
          return '';
      }
    });

    console.log(
        `${jsonKey} has types of ${validTypesFriendlyString.join(',')}`);

    if (validTypes.indexOf(jsonValue.valueKind) === -1) {
      const startIndex = jsonValue.span.startIndex;
      const endIndex = jsonValue.span.endIndex;
      const message =
          `Unexpected value. Expect ${validTypesFriendlyString.join(', ')}.`;
      const issue: Issue = {startIndex, endIndex, message};
      issues.push(issue);
    }

    if (issues.length) {
      return issues;
    }

    if (jsonValue.valueKind === Json.ValueKind.ArrayValue) {
      for (const element of (jsonValue as Json.ArrayValue).elements) {
        issues = issues.concat(
            this.getTypeIssues(pnpContext, document, element, jsonKey, true));
      }
    } else if (jsonValue.valueKind === Json.ValueKind.ObjectValue) {
      for (const key of (jsonValue as Json.ObjectValue).propertyNames) {
        const value = (jsonValue as Json.ObjectValue).getPropertyValue(key);
        issues =
            issues.concat(this.getTypeIssues(pnpContext, document, value, key));
      }
    } else if (valueType === 'int' || valueType === 'long') {
      const value = Number((jsonValue as Json.NumberValue).toFriendlyString());
      if (Math.floor(value) !== value) {
        const startIndex = jsonValue.span.startIndex;
        const endIndex = jsonValue.span.endIndex;
        const message = `Invalid value. Valid value is ${valueType} number.`;
        const issue: Issue = {startIndex, endIndex, message};
        issues.push(issue);
      }
    }

    return issues;
  }

  getInvalidTypeIssue(
      pnpContext: PnPMetaModelContext, document: vscode.TextDocument,
      jsonValue: Json.ObjectValue, jsonKey?: string) {
    let types: string[];
    if (jsonKey) {
      const id = this._pnpParser.getIdFromShortName(pnpContext, jsonKey);
      if (!id) {
        return null;
      }
      types = this._pnpParser.getTypesFromId(pnpContext, id);
    } else {
      const documentType = /\.interface\.json$/.test(document.uri.fsPath) ?
          'Interface' :
          'Template';
      types = [documentType];
    }

    const type = this.getType(pnpContext, document, jsonValue, jsonKey);
    if (type && types.indexOf(type) === -1) {
      const typeValue = jsonValue.getPropertyValue('@type') as Json.StringValue;
      const startIndex = typeValue.span.startIndex;
      const endIndex = typeValue.span.endIndex;
      const message = `Invalid type. Valid types:\n${types.join('\n')}`;
      const issue: Issue = {startIndex, endIndex, message};
      return issue;
    }

    return null;
  }

  getMissingRequiredPropertiesIssues(
      jsonValue: Json.ObjectValue, type: string) {
    const issues: Issue[] = [];
    const missingRequiredProperties: string[] = [];
    const requiredProperties =
        this._pnpParser.getRequiredPropertiesFromType(type);
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
      pnpContext: PnPMetaModelContext, jsonValue: Json.ObjectValue,
      type: string) {
    let properties =
        this._pnpParser.getTypedPropertiesFromType(pnpContext, type)
            .map(property => property.label);
    properties = uniq(
        properties.concat(this._pnpParser.getRequiredPropertiesFromType(type)));
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

  update(pnpContext: PnPMetaModelContext, document: vscode.TextDocument) {
    const issues = this.getIssues(pnpContext, document);
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