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



export class PnPConnectionStringBuilder {
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


  static Create(pnpConnectionString: string): PnPConnectionStringBuilder {
    const iotHubConnectionStringBuilder = new PnPConnectionStringBuilder();
    iotHubConnectionStringBuilder.Parse(pnpConnectionString);
    return iotHubConnectionStringBuilder;
  }

  ValidateFormat(value: string, propertyName: string, regex: RegExp) {
    if (value) {
      if (!regex.test(value)) {
        throw Error(
            `The connection string is invalid for property ${propertyName}`);
      }
    }
  }


  Parse(pnpConnectionString: string): void {
    if (!pnpConnectionString) {
      throw Error('The connection string should not be empty');
    }

    const items: {[propertyName: string]: string;} = {};

    const pairs = pnpConnectionString.split(constants.ValuePairDelimiter);
    pairs.forEach(value => {
      const index = value.indexOf(constants.ValuePairSeparator);
      if (index <= 0) {
        throw Error(
            `The format of the connection string is not valid: ${value}`);
      }

      const propertyName = value.substr(0, index);
      const propertyValue = value.substr(index + 1, value.length - index - 1);
      if (!propertyName || !propertyValue) {
        throw Error(
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
      throw Error('Unable to find the host name in the connection string.');
    } else if (!this.repositoryId) {
      throw Error('Unable to find the repositoryId in the connection string.');
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
