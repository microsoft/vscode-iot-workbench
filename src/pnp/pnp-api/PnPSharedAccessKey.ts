// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import {createHmac} from 'crypto';
import {PnPConnectionStringBuilder} from './PnPConnectionStringBuilder';

const constants = {
  SharedAccessSignature: 'SharedAccessSignature',
  AudienceFieldName: 'sr',
  SignatureFieldName: 'sig',
  KeyNameFieldName: 'skn',
  ExpiryFieldName: 'se'
};


export class PnPSharedAccessKey {
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

  constructor(builder: PnPConnectionStringBuilder) {
    this.audience = builder.HostName;
    this.keyId = builder.SharedAccessKeyName;
    this.secret = builder.SharedAccessKeyValue;
    this.repositoryId = builder.RepositoryIdValue;
    const now = new Date();
    const ms = 1000;
    this.expiry = (now.setDate(new Date().getDate() + 1) / ms).toFixed(0);
  }

  GenerateSASToken(): string {
    const encodedServiceEndpoint = encodeURIComponent(this.audience);
    const signature = [
      encodeURIComponent(this.repositoryId), encodedServiceEndpoint, this.expiry
    ].join('\n').toLowerCase();
    const sigUTF8 = new Buffer(signature, 'utf8');
    const secret64bit = new Buffer(this.secret, 'base64');
    const hmac = createHmac('sha256', secret64bit);
    hmac.update(sigUTF8);
    const hash = encodeURIComponent(hmac.digest('base64'));
    return `${constants.SharedAccessSignature} sr=${
        encodedServiceEndpoint}&sig=${hash}&se=${this.expiry}&skn=${
        this.keyId}&rid=${this.repositoryId}`;
  }

  static Parse(connectionString: string): PnPSharedAccessKey {
    const builder = PnPConnectionStringBuilder.Create(connectionString);
    return new PnPSharedAccessKey(builder);
  }
}