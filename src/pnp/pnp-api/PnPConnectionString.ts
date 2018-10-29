// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';
import {PnPConnectionStringBuilder} from './PnPConnectionStringBuilder';

export class PnPConnectionString {
  private hostName: string;
  private sharedAccessKeyName: string;
  private sharedAccessKeyValue: string;
  private httpEndpoint: vscode.Uri;

  get HostName() {
    return this.hostName;
  }

  get SharedAccessKeyName() {
    return this.sharedAccessKeyName;
  }

  get SharedAccessKeyValue() {
    return this.sharedAccessKeyValue;
  }

  get HttpEndpoint() {
    return this.httpEndpoint;
  }

  constructor(builder: PnPConnectionStringBuilder) {
    this.hostName = builder.HostName;
    this.sharedAccessKeyName = builder.SharedAccessKeyName;
    this.sharedAccessKeyValue = builder.SharedAccessKeyValue;
    this.httpEndpoint = vscode.Uri.parse(`https://${this.hostName}`);
  }

  GetAuthorizationHeader(): string {
    return `SharedAccessSignature SharedAccessKeyName=${
        this.SharedAccessKeyName};SharedAccessKey=${this.sharedAccessKeyValue}`;
  }

  static Parse(connectionString: string): PnPConnectionString {
    const builder = PnPConnectionStringBuilder.Create(connectionString);
    return new PnPConnectionString(builder);
  }
}