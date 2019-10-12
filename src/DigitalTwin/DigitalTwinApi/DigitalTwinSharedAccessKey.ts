// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import {createHmac} from 'crypto';
import {DigitalTwinConnectionStringBuilder} from './DigitalTwinConnectionStringBuilder';

const constants = {
  SharedAccessSignature: 'SharedAccessSignature',
  AudienceFieldName: 'sr',
  SignatureFieldName: 'sig',
  KeyNameFieldName: 'skn',
  ExpiryFieldName: 'se',
  ExpiryInMinutes: 30
};


export class DigitalTwinSharedAccessKey {
  private _keyId: string;
  private _secret: string;
  private _audience: string;
  private _repositoryId: string;
  private expiry: string;

  get keyId() {
    return this._keyId;
  }

  get secret() {
    return this._secret;
  }

  get audience() {
    return this._audience;
  }

  get repositoryId() {
    return this._repositoryId;
  }

  constructor(builder: DigitalTwinConnectionStringBuilder) {
    this._audience = builder.hostName;
    this._keyId = builder.sharedAccessKeyName;
    this._secret = builder.sharedAccessKeyValue;
    this._repositoryId = builder.repositoryIdValue;
    const now = new Date();
    const ms = 1000;
    this.expiry =
        (Math.round(now.getTime() / ms) + constants.ExpiryInMinutes * 60)
            .toString();
  }

  generateSASToken(): string {
    const encodedServiceEndpoint = encodeURIComponent(this._audience);
    const signature = [
      encodeURIComponent(this._repositoryId), encodedServiceEndpoint,
      this.expiry
    ].join('\n').toLowerCase();
    const sigUTF8 = new Buffer(signature, 'utf8');
    const secret64bit = new Buffer(this._secret, 'base64');
    const hmac = createHmac('sha256', secret64bit);
    hmac.update(sigUTF8);
    const hash = encodeURIComponent(hmac.digest('base64'));
    return `${constants.SharedAccessSignature} sr=${
        encodedServiceEndpoint}&sig=${hash}&se=${this.expiry}&skn=${
        this._keyId}&rid=${this._repositoryId}`;
  }

  static parse(connectionString: string): DigitalTwinSharedAccessKey {
    const builder = DigitalTwinConnectionStringBuilder.create(connectionString);
    return new DigitalTwinSharedAccessKey(builder);
  }
}