import * as vscode from 'vscode';

import * as Json from './JSON';
import {PnPMetaModelContext} from './PnPMetaModelUtility';

export class PnPMetaModelJsonParser {
  static getJsonValueFromStack(
      jsonValue: Json.Value, stack: Array<string|number>) {
    for (let i = 0; i < stack.length; i++) {
      if (typeof stack[i] === 'string') {
        const key = stack[i] as string;
        if (jsonValue.valueKind !== Json.ValueKind.ObjectValue ||
            !(jsonValue as Json.ObjectValue).hasProperty(key)) {
          return null;
        }
        jsonValue = (jsonValue as Json.ObjectValue).getPropertyValue(key);
      } else {
        const index = stack[i] as number;
        if (jsonValue.valueKind !== Json.ValueKind.ArrayValue ||
            (jsonValue as Json.ArrayValue).length <= index) {
          return null;
        }
        jsonValue = (jsonValue as Json.ArrayValue).elements[index];
      }
    }
    return jsonValue;
  }

  static getTokenRange(tokens: Json.Token[], offset: number) {
    let startIndex = offset;
    let endIndex = offset + 1;
    for (const token of tokens) {
      if (token.span.startIndex <= offset && token.span.endIndex >= offset) {
        if ([
              Json.TokenType.Boolean, Json.TokenType.Null,
              Json.TokenType.Number, Json.TokenType.Literal
            ].indexOf(token.type) > -1) {
          startIndex = token.span.startIndex;
          endIndex = token.span.endIndex + 1;
        } else {
          break;
        }
      }
    }

    return {startIndex, endIndex};
  }

  static isValueString(tokens: Json.Token[], offset: number) {
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].span.startIndex <= offset &&
          tokens[i].span.endIndex >= offset) {
        if (i >= 1 && tokens[i].type === Json.TokenType.QuotedString &&
            tokens[i - 1].type === Json.TokenType.Colon) {
          return true;
        }
        break;
      }
    }
    return false;
  }

  static getContextFromOffset(jsonValue: Json.Value, offset: number):
      Array<string|number> {
    let stack: Array<string|number> = [];
    switch (jsonValue.valueKind) {
      case Json.ValueKind.ArrayValue: {
        const json = jsonValue as Json.ArrayValue;
        for (let i = 0; i < json.length; i++) {
          const value = json.elements[i];
          if (value.span.startIndex <= offset &&
              value.span.startIndex + value.span.length >= offset) {
            stack = [i];
            return stack.concat(
                PnPMetaModelJsonParser.getContextFromOffset(value, offset));
          }
        }
        return [];
      }
      case Json.ValueKind.ObjectValue: {
        const json = jsonValue as Json.ObjectValue;
        for (const key of json.propertyNames) {
          const value = json.getPropertyValue(key);
          if (value.span.startIndex <= offset &&
              value.span.startIndex + value.span.length >= offset) {
            stack = [key];
            return stack.concat(
                PnPMetaModelJsonParser.getContextFromOffset(value, offset));
          }
        }
        return [];
      }
      // case Json.ValueKind.BooleanValue:
      //     break;
      // case Json.ValueKind.NullValue:
      //     break;
      // case Json.ValueKind.NumberValue:
      //     break;
      // case Json.ValueKind.PropertyValue:
      //     break;
      // case Json.ValueKind.StringValue:
      //     break;
      default:
        return [];
    }
  }

  static getCompletionItemsFromArray(
      chars: Array<string|{label: string, type?: string}>,
      startPosition: vscode.Position, endPosition: vscode.Position) {
    const items: vscode.CompletionItem[] = [];
    for (const char of chars) {
      const label = typeof char === 'string' ? char : char.label;
      const item = new vscode.CompletionItem(`$(plug) ${label}`);
      if (typeof char !== 'string') {
        switch (char.type) {
          case 'string':
            item.insertText = `${label}": ""`;
            break;
          case 'int':
            item.insertText = `${label}": 0`;
            break;
          case 'float':
            item.insertText = `${label}": 0.0`;
            break;
          case 'boolean':
            item.insertText = `${label}": true`;
            break;
          case 'array':
            item.insertText = `${label}": []`;
            break;
          default:
            item.insertText = `${label}": `;
        }
      } else {
        item.insertText = `${label}"`;
      }
      item.range = new vscode.Range(startPosition, endPosition);
      items.push(item);
    }
    return items;
  }

  static getIdAtPosition(
      document: vscode.TextDocument, position: vscode.Position,
      pnpInterface: PnPMetaModelContext) {
    const text = document.getText();
    const json = Json.parse(text);
    if (!json) {
      return null;
    }
    const offset = document.offsetAt(position);
    let shortName = '';
    for (const token of json.tokens) {
      if (token.type === Json.TokenType.QuotedString &&
          token.span.startIndex <= offset && token.span.endIndex >= offset) {
        shortName =
            text.substr(token.span.startIndex + 1, token.span.length - 2);
        break;
      }
    }
    if (shortName) {
      if (pnpInterface['@context'].hasOwnProperty(shortName)) {
        let id = '';
        const item = pnpInterface['@context'][shortName];
        if (typeof item === 'string') {
          id = pnpInterface['@context']['@vocab'] + item;
        } else {
          id = pnpInterface['@context']['@vocab'] + item['@id'];
        }
        return id;
      }
      return shortName;
    }

    return null;
  }

  static getJsonInfoAtPosition(
      document: vscode.TextDocument, position: vscode.Position) {
    const text = document.getText();
    const json = Json.parse(text);
    if (!json) {
      return null;
    }
    const offset = document.offsetAt(position);
    const jsonContext =
        PnPMetaModelJsonParser.getContextFromOffset(json.value, offset);
    const isValue = PnPMetaModelJsonParser.isValueString(json.tokens, offset);
    let key = '';
    let lastKey = '';
    let type = '';
    let properties: string[] = [];

    if (isValue) {
      for (let i = jsonContext.length - 1; i >= 0; i--) {
        const currentLabel = jsonContext[i];
        if (typeof currentLabel === 'string') {
          if (!key) {
            key = currentLabel;
          } else if (!lastKey) {
            lastKey = currentLabel;
            break;
          }
        }
      }
    } else {
      const jsonValueFromStack =
          PnPMetaModelJsonParser.getJsonValueFromStack(json.value, jsonContext);
      if (jsonValueFromStack &&
          jsonValueFromStack.valueKind === Json.ValueKind.ObjectValue) {
        const jsonValue = jsonValueFromStack as Json.ObjectValue;

        if (jsonValue.hasProperty('@type')) {
          type = jsonValue.getPropertyValue('@type').toFriendlyString();
        } else if (jsonContext.length > 0) {
          let i = jsonContext.length - 1;
          let lastKeyInContext: number|string = '';
          do {
            lastKeyInContext = jsonContext[i];
            i--;
          } while (i >= 0 && typeof lastKeyInContext !== 'string');
          if (typeof lastKeyInContext === 'string') {
            lastKey = lastKeyInContext;
          }
        }

        properties = jsonValue.propertyNames;
      }
    }

    return {json, offset, isValue, type, properties, key, lastKey};
  }
}