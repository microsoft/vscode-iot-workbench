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
  private hostName: string;
  private repositoryId: string;
  private sharedAccessKeyName: string;
  private sharedAccessKeyValue: string;

  private constructor() {
    this.hostName = '';
    this.repositoryId = '';
    this.sharedAccessKeyName = '';
    this.sharedAccessKeyValue = '';
  }

  get HostName() {
    return this.hostName;
  }

  get SharedAccessKeyName() {
    return this.sharedAccessKeyName;
  }

  get SharedAccessKeyValue() {
    return this.sharedAccessKeyValue;
  }

  get RepositoryIdValue() {
    return this.repositoryId;
  }


  static Create(dtConnectionString: string):
      DigitalTwinConnectionStringBuilder {
    const dtConnectionStringBuilder = new DigitalTwinConnectionStringBuilder();
    dtConnectionStringBuilder.Parse(dtConnectionString);
    return dtConnectionStringBuilder;
  }

  ValidateFormat(value: string, propertyName: string, regex: RegExp) {
    if (value) {
      if (!regex.test(value)) {
        throw new Error(
            `The connection string is invalid for property ${propertyName}`);
      }
    }
  }


  Parse(dtConnectionString: string): void {
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
        this.hostName = items[key];
      } else if (key === constants.RepositoryIdPropertyName) {
        this.repositoryId = items[key];
      } else if (key === constants.SharedAccessKeyNamePropertyName) {
        this.sharedAccessKeyName = items[key];
      } else if (key === constants.SharedAccessKeyValuePropertyName) {
        this.sharedAccessKeyValue = items[key];
      }
    }

    if (!this.hostName) {
      throw new Error('Unable to find the host name in the connection string.');
    } else if (!this.repositoryId) {
      throw new Error(
          'Unable to find the repositoryId in the connection string.');
    }

    this.Validate();
  }

  Validate(): void {
    this.ValidateFormat(
        this.HostName, constants.HostNamePropertyName, constants.HostNameRegex);
    this.ValidateFormat(
        this.SharedAccessKeyName, constants.SharedAccessKeyNamePropertyName,
        constants.SharedAccessKeyNameRegex);
    this.ValidateFormat(
        this.SharedAccessKeyValue, constants.SharedAccessKeyValuePropertyName,
        constants.SharedAccessKeyValueRegex);
  }
}
