// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { createHmac } from 'crypto';
import { DigitalTwinConnectionStringBuilder } from './DigitalTwinConnectionStringBuilder';

const constants = {
  SharedAccessSignature: 'SharedAccessSignature',
  AudienceFieldName: 'sr',
  SignatureFieldName: 'sig',
  KeyNameFieldName: 'skn',
  ExpiryFieldName: 'se',
  ExpiryInMinutes: 30,
};

export class DigitalTwinSharedAccessKey {
  private keyId: string;
  private secret: string;
  private audience: string;
  private repositoryId: string;
  private expiry: string;

  get KeyId() {
    return this.keyId;
  }

  get Secret() {
    return this.secret;
  }

  get Audience() {
    return this.audience;
  }

  get RepositoryId() {
    return this.repositoryId;
  }

  constructor(builder: DigitalTwinConnectionStringBuilder) {
    this.audience = builder.HostName;
    this.keyId = builder.SharedAccessKeyName;
    this.secret = builder.SharedAccessKeyValue;
    this.repositoryId = builder.RepositoryIdValue;
    const now = new Date();
    const ms = 1000;
    this.expiry = (
      Math.round(now.getTime() / ms) +
      constants.ExpiryInMinutes * 60
    ).toString();
  }

  GenerateSASToken(): string {
    const encodedServiceEndpoint = encodeURIComponent(this.audience);
    const signature = [
      encodeURIComponent(this.repositoryId),
      encodedServiceEndpoint,
      this.expiry,
    ]
      .join('\n')
      .toLowerCase();

    const sigUTF8 = Buffer.from(signature, 'utf8'); // new Buffer(signature, 'utf8');
    const secret64bit = Buffer.from(this.secret, 'base64'); //new Buffer(this.secret, 'base64');
    const hmac = createHmac('sha256', secret64bit);
    hmac.update(sigUTF8);
    const hash = encodeURIComponent(hmac.digest('base64'));
    return `${constants.SharedAccessSignature} sr=${encodedServiceEndpoint}&sig=${hash}&se=${this.expiry}&skn=${this.keyId}&rid=${this.repositoryId}`;
  }

  static Parse(connectionString: string): DigitalTwinSharedAccessKey {
    const builder = DigitalTwinConnectionStringBuilder.Create(connectionString);
    return new DigitalTwinSharedAccessKey(builder);
  }
}
