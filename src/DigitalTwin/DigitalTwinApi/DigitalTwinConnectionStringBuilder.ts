// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const constants = {
  ValuePairDelimiter: ';',
  ValuePairSeparator: '=',
  HostNamePropertyName: 'HostName',
  RepositoryIdPropertyName: 'RepositoryId',
  SharedAccessKeyNamePropertyName: 'SharedAccessKeyName',
  SharedAccessKeyValuePropertyName: 'SharedAccessKey',
  HostNameRegex: new RegExp('[a-zA-Z0-9_\\-\\.]+$'),
  SharedAccessKeyNameRegex: new RegExp('^[a-zA-Z0-9_\\-@\\.]+$'),
  SharedAccessKeyValueRegex: new RegExp('^.+$')
};

export class DigitalTwinConnectionStringBuilder {
  private _hostName: string;
  private _repositoryId: string;
  private _sharedAccessKeyName: string;
  private _sharedAccessKeyValue: string;

  private constructor() {
    this._hostName = '';
    this._repositoryId = '';
    this._sharedAccessKeyName = '';
    this._sharedAccessKeyValue = '';
  }

  get hostName() {
    return this._hostName;
  }

  get sharedAccessKeyName() {
    return this._sharedAccessKeyName;
  }

  get sharedAccessKeyValue() {
    return this._sharedAccessKeyValue;
  }

  get repositoryIdValue() {
    return this._repositoryId;
  }


  static create(dtConnectionString: string):
      DigitalTwinConnectionStringBuilder {
    const dtConnectionStringBuilder = new DigitalTwinConnectionStringBuilder();
    dtConnectionStringBuilder.parse(dtConnectionString);
    return dtConnectionStringBuilder;
  }

  validateFormat(value: string, propertyName: string, regex: RegExp) {
    if (value) {
      if (!regex.test(value)) {
        throw new Error(
            `The connection string is invalid for property ${propertyName}`);
      }
    }
  }


  parse(dtConnectionString: string): void {
    if (!dtConnectionString) {
      throw new Error('The connection string should not be empty');
    }

    const items: {[propertyName: string]: string;} = {};

    const pairs = dtConnectionString.split(constants.ValuePairDelimiter);
    pairs.forEach(value => {
      const index = value.indexOf(constants.ValuePairSeparator);
      if (index <= 0) {
        throw new Error(
            `The format of the connection string is not valid: ${value}`);
      }

      const propertyName = value.substr(0, index);
      const propertyValue = value.substr(index + 1, value.length - index - 1);
      if (!propertyName || !propertyValue) {
        throw new Error(
            `The format of the connection string is not valid: ${value}`);
      }
      items[propertyName] = propertyValue;
    });

    for (const key in items) {
      if (key === constants.HostNamePropertyName) {
        this._hostName = items[key];
      } else if (key === constants.RepositoryIdPropertyName) {
        this._repositoryId = items[key];
      } else if (key === constants.SharedAccessKeyNamePropertyName) {
        this._sharedAccessKeyName = items[key];
      } else if (key === constants.SharedAccessKeyValuePropertyName) {
        this._sharedAccessKeyValue = items[key];
      }
    }

    if (!this._hostName) {
      throw new Error('Unable to find the host name in the connection string.');
    } else if (!this._repositoryId) {
      throw new Error(
          'Unable to find the repositoryId in the connection string.');
    }

    this.validate();
  }

  validate(): void {
    this.validateFormat(
        this.hostName, constants.HostNamePropertyName, constants.HostNameRegex);
    this.validateFormat(
        this.sharedAccessKeyName, constants.SharedAccessKeyNamePropertyName,
        constants.SharedAccessKeyNameRegex);
    this.validateFormat(
        this.sharedAccessKeyValue, constants.SharedAccessKeyValuePropertyName,
        constants.SharedAccessKeyValueRegex);
  }
}
