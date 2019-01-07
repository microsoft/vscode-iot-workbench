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
    // let startIndex = offset;
    // let endIndex = offset + 1;
    // for (const token of tokens) {
    //   if (token.span.startIndex <= offset && token.span.endIndex >= offset) {
    //     if ([
    //           Json.TokenType.Boolean, Json.TokenType.Null,
    //           Json.TokenType.Number, Json.TokenType.Literal
    //         ].indexOf(token.type) > -1) {
    //       startIndex = token.span.startIndex;
    //       endIndex = token.span.endIndex + 1;
    //     } else {
    //       break;
    //     }
    //   }
    // }

    // Default insert text at current position
    let startIndex = offset;
    let endIndex = offset;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      // The position is inside a token, replace the whole token
      if (token.span.startIndex < offset && token.span.afterEndIndex > offset) {
        // Just replace it
        startIndex = token.span.startIndex;
        endIndex = token.span.afterEndIndex;

        // This token is within quotes, replace the quotes as well
        if (i > 0 && tokens[i - 1].type === Json.TokenType.QuotedString) {
          startIndex = tokens[i - 1].span.startIndex;
          endIndex = tokens[i + 1].span.afterEndIndex;
        }
        break;
      } else if (token.span.afterEndIndex === offset) {
        if (token.type === Json.TokenType.QuotedString) {
          // " " : " v a l u e "
          //  ^
          startIndex = token.span.startIndex;

          // Do not use tokens[i + 1].span.endIndex here,
          // Tokens have been upated for auto add right quote
          endIndex = token.span.afterEndIndex + 1;
        } else {
          if (i > 0 && tokens[i - 1].type === Json.TokenType.QuotedString) {
            // " k e y " : " v a l u e "
            //        ^
            startIndex = tokens[i - 1].span.startIndex;
            endIndex = tokens[i + 1].span.afterEndIndex;
          } else {
            // k e y : " v a l u e "
            //      ^
            startIndex = token.span.startIndex;
            endIndex = token.span.afterEndIndex;
          }
        }
        break;
      } else if (token.span.startIndex === offset) {
        if (i > 0 && tokens[i - 1].type === Json.TokenType.QuotedString) {
          // " k e y " : " v a l u e "
          //  ^
          startIndex = tokens[i - 1].span.startIndex;
          endIndex = tokens[i + 1].span.afterEndIndex;
        } else {
          //  k e y : " v a l u e "
          // ^
          startIndex = token.span.startIndex;
          endIndex = token.span.afterEndIndex;
        }
        break;
      }
    }

    return {startIndex, endIndex};
  }

  static isValueString(tokens: Json.Token[], offset: number) {
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].span.startIndex <= offset &&
          tokens[i].span.afterEndIndex >= offset) {
        if (i >= 1) {
          if (tokens[i].type === Json.TokenType.QuotedString &&
              tokens[i - 1].type === Json.TokenType.Colon) {
            return true;
          }

          for (let tokenIndex = i - 1; tokenIndex >= 0; tokenIndex--) {
            if (tokens[tokenIndex].type === Json.TokenType.LeftCurlyBracket) {
              break;
            }

            if (tokens[tokenIndex].type === Json.TokenType.LeftSquareBracket) {
              return true;
            }
          }
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
      chars: Array<string|{label: string, required: boolean, type?: string}>,
      currentPosition: vscode.Position, startPosition: vscode.Position,
      endPosition: vscode.Position) {
    const items: vscode.CompletionItem[] = [];
    for (const char of chars) {
      const label = typeof char === 'string' ? char : char.label;
      if (label.indexOf('XMLSchema#') !== -1) {
        continue;
      }
      const labelText = typeof char === 'string' ?
          label :
          (label + (!char.required ? ' (optional)' : ''));
      const item = new vscode.CompletionItem(labelText);
      if (typeof char !== 'string') {
        // insertText is vscode snippet string
        // https://code.visualstudio.com/docs/editor/userdefinedsnippets#_snippet-syntax
        let insertText: string;

        switch (char.type) {
          case 'string':
            insertText = `"${label}": "$1"$0`;
            break;
          case 'int':
          case 'long':
            insertText = `"${label}": $\{1:0\}$0`;
            break;
          case 'float':
          case 'double':
            insertText = `"${label}": $\{1:0.0\}$0`;
            break;
          case 'boolean':
            insertText = `"${label}": $\{1:true\}$0`;
            break;
          case 'array':
            if (label === 'implements') {
              insertText = `"${label}": [\n\t$1\n]$0`;
            } else {
              insertText = `"${label}": [\n\t{\n\t\t$1\n\t}$2\n]$0`;
            }
            break;
          default:
            insertText = `"${label}": `;
        }
        item.insertText = new vscode.SnippetString(insertText);
        if (char.required) {
          item.sortText = `!${label}`;
        } else {
          item.sortText = label;
        }
      } else {
        item.insertText = `"${label}"`;
      }
      item.range = new vscode.Range(currentPosition, endPosition);
      if (currentPosition.character !== startPosition.character) {
        item.additionalTextEdits = [vscode.TextEdit.delete(
            new vscode.Range(startPosition, currentPosition))];
      }
      items.push(item);
    }
    return items;
  }

  static getIdAtPosition(
      document: vscode.TextDocument, position: vscode.Position,
      pnpContext: PnPMetaModelContext) {
    const text = document.getText();
    const json = Json.parse(text);
    if (!json) {
      return null;
    }
    const offset = document.offsetAt(position);
    let shortName = '';
    for (const token of json.tokens) {
      if (token.type === Json.TokenType.QuotedString &&
          token.span.startIndex <= offset &&
          token.span.afterEndIndex >= offset) {
        shortName =
            text.substr(token.span.startIndex + 1, token.span.length - 2);
        break;
      }
    }
    if (shortName) {
      if (pnpContext['@context'].hasOwnProperty(shortName)) {
        let id = '';
        const item = pnpContext['@context'][shortName];
        if (typeof item === 'string') {
          id = pnpContext['@context']['@vocab'] + item;
        } else {
          id = pnpContext['@context']['@vocab'] + item['@id'];
        }
        return id;
      }
      return shortName;
    }

    return null;
  }

  static getPnpContextTypeAtPosition(
      document: vscode.TextDocument, position: vscode.Position,
      contextType: string) {
    const text = document.getText();
    const json = Json.parse(text);
    if (!json) {
      return contextType;
    }
    const offset = document.offsetAt(position);
    return PnPMetaModelJsonParser.getPnpContextTypeFromOffset(
        json.value, offset, contextType);
  }

  static getPnpContextTypeFromOffset(
      jsonValue: Json.Value, offset: number,
      currentContextType: string): string {
    switch (jsonValue.valueKind) {
      case Json.ValueKind.ArrayValue: {
        const json = jsonValue as Json.ArrayValue;
        for (let i = 0; i < json.length; i++) {
          const value = json.elements[i];
          if (value.span.startIndex <= offset &&
              value.span.startIndex + value.span.length >= offset) {
            return PnPMetaModelJsonParser.getPnpContextTypeFromOffset(
                value, offset, currentContextType);
          }
        }
        return currentContextType;
      }
      case Json.ValueKind.ObjectValue: {
        const json = jsonValue as Json.ObjectValue;
        if (json.hasProperty('@type')) {
          const type = json.getPropertyValue('@type').toFriendlyString();
          if (type === 'Interface' || type === 'CapabilityModel') {
            currentContextType = type;
          }
        }
        for (const key of json.propertyNames) {
          const value = json.getPropertyValue(key);
          if (value.span.startIndex <= offset &&
              value.span.startIndex + value.span.length >= offset) {
            return PnPMetaModelJsonParser.getPnpContextTypeFromOffset(
                value, offset, currentContextType);
          }
        }
        return currentContextType;
      }
      default:
        return currentContextType;
    }
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