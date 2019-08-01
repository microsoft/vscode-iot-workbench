// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import * as fs from 'fs-plus';

import {ConfigKey} from '../constants';
import {CredentialStore} from '../credentialStore';

import {DigitalTwinConnectionStringBuilder} from './DigitalTwinApi/DigitalTwinConnectionStringBuilder';
import {DTDLKeywords} from './DigitalTwinConstants';

/**
 * Create a deep copy of the provided value.
 */
export function clone<T>(value: T): T {
  let result: T;

  if (value === null || value === undefined || typeof value === 'boolean' ||
      typeof value === 'number' || typeof value === 'string') {
    result = value;
  } else {
    const jsonString = JSON.stringify(value);
    result = JSON.parse(jsonString);
  }

  return result;
}

export function isWhitespaceCharacter(character: string): boolean {
  return character === ' ' || character === '\t' || character === '\n' ||
      character === '\r';
}

export function isQuoteCharacter(character: string): boolean {
  return character === '\'' || character === '"';
}

export function isDigit(character: string): boolean {
  return character ? '0' <= character && character <= '9' : false;
}

export function isLetter(character: string): boolean {
  return character ? ('A' <= character && character <= 'Z') ||
          ('a' <= character && character <= 'z') :
                     false;
}

export function unquote(value: string): string {
  let result = value;

  if (result) {
    if (isQuoteCharacter(result[0])) {
      result = result.substr(1);
    }
    if (result && isQuoteCharacter(result[result.length - 1])) {
      result = result.substr(0, result.length - 1);
    }
  }

  return result;
}

export function quote(value: string): string {
  let result;
  if (value === null) {
    result = 'null';
  } else if (value === undefined) {
    result = 'undefined';
  } else {
    result = `"${value}"`;
  }
  return result;
}

export function escape(value: string): string {
  let result;
  if (value) {
    result = '';
    for (const c of value) {
      switch (c) {
        case '\b':
          result += '\\b';
          break;

        case '\f':
          result += '\\f';
          break;

        case '\n':
          result += '\\n';
          break;

        case '\r':
          result += '\\r';
          break;

        case '\t':
          result += '\\t';
          break;

        case '\v':
          result += '\\v';
          break;

        default:
          result += c;
          break;
      }
    }
  } else {
    result = value;
  }
  return result;
}

export function escapeAndQuote(value: string): string {
  return quote(escape(value));
}

/**
 * Get the combined length of the provided values.
 */
export function getCombinedLength(values: Array<{length(): number}>): number {
  let result = 0;
  if (values) {
    for (const value of values) {
      result += value.length();
    }
  }
  return result;
}

/**
 * Get the combined text of the provided values.
 */
export function getCombinedText(values: Array<{toString(): string}>): string {
  let result = '';
  if (values) {
    for (const value of values) {
      result += value.toString();
    }
  }
  return result;
}

export function isValidSchemaUri(schema: string): boolean {
  return schema ?
      schema.match(
          /https?:\/\/schema.management.azure.com\/schemas\/.*\/deploymentTemplate.json/) !==
          null :
      false;
}


/**
 * Retrieves all interface or DCM files under the specified folder.
 */
export interface SchemaFileInfo {
  id: string;
  type: string;
  filePath: string;
}

export function listAllPnPSchemaFilesSync(
    folder: string, dcmFiles: SchemaFileInfo[],
    interfaceFiles: SchemaFileInfo[]): boolean {
  const fileList = fs.listTreeSync(folder);
  if (fileList && fileList.length > 0) {
    fileList.forEach((filePath: string) => {
      if (!fs.isDirectorySync(filePath) &&
          filePath.toLowerCase().endsWith('.json')) {
        // JSON file
        let urnId = '';
        let type = '';
        let context = '';
        try {
          // Try to find DTDL properties
          const fileJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          urnId = fileJson['@id'];
          type = fileJson['@type'];
          context = fileJson['@context'];
        } catch {
          type = '';
        }
        if (context === '') {
          type = '';
        }
        if (type === DTDLKeywords.typeValueDCM) {
          // DCM file
          dcmFiles.push({id: urnId, type: DTDLKeywords.typeValueDCM, filePath});
        } else if (type === DTDLKeywords.typeValueInterface) {
          // Interface file
          interfaceFiles.push(
              {id: urnId, type: DTDLKeywords.typeValueInterface, filePath});
        }
      }
    });
  }
  return true;
}

export async function SaveCompanyRepoConnectionString(
    connectionString: string) {
  // Validate the the format of the model repository key
  DigitalTwinConnectionStringBuilder.Create(connectionString);

  await CredentialStore.setCredential(
      ConfigKey.modelRepositoryKeyName, connectionString);
}

export function GenerateDigitalTwinIdentifier(name: string): string {
  return `urn:{your name}:${name}:1`;
}

/**
 * An interface for an object that iterates through a sequence of values.
 */
export interface Iterator<T> {
  /**
   * Get whether or not this iterator has started iterating.
   */
  hasStarted(): boolean;

  /**
   * Get the iterator's current value, or undefined if the iterator doesn't have
   * a current value.
   */
  current(): T;

  /**
   * Move this iterator to the next value in its sequnce. Return whether or not
   * the iterator has a current value after the move.
   */
  moveNext(): boolean;
}
