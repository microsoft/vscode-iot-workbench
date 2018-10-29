// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';

const constants = {
  idRegEx: new RegExp('^[A-Za-z0-9\\-._:/]{1,64}$'),
  nameRegEx: new RegExp('^[A-Za-z_][A-Za-z0-9_]{1,64}$'),
  versionRegEx: new RegExp('^[\\d]+\\.[\\d]+\\.[\\d]+$'),
  idDelimiter: '/'
};

export class PnPUri {
  private id: string;
  private namespace: string;
  private name: string;
  private version: string;

  get Id() {
    return this.id;
  }

  get Namespace() {
    return this.namespace;
  }

  get Name() {
    return this.name;
  }

  get Version() {
    return this.version;
  }

  private constructor(
      id: string, namespace: string, name: string, version: string) {
    this.id = id;
    this.namespace = namespace;
    this.name = name;
    this.version = version;
  }

  static Parse(metamodelUriId: string): PnPUri {
    if (!metamodelUriId) {
      throw new Error('The input meta model Uri could not be empty');
    }

    const uri = vscode.Uri.parse(
        metamodelUriId);  // Throws any parsing errors for being a valid uri

    if (!constants.idRegEx.test(metamodelUriId)) {
      throw new Error('metamodelUriId is not valid');
    }

    const splitStrings = metamodelUriId.split(constants.idDelimiter);
    if (splitStrings.length < 3) {
      throw new Error('metamodelUriId should contain minimum of 3 parts');
    }

    const versionString: string = splitStrings[splitStrings.length - 1];

    if (!constants.versionRegEx.test(versionString)) {
      throw new Error('metamodelUriId version is not valid');
    }

    const name = splitStrings[splitStrings.length - 2];
    if (!constants.nameRegEx.test(name)) {
      throw new Error('metamodelUriId name is not valid');
    }

    const namespace = metamodelUriId.substring(
        0,
        metamodelUriId.length - (versionString.length + 1 + name.length + 1));

    const pnpUri = new PnPUri(metamodelUriId, namespace, name, versionString);

    return pnpUri;
  }
}