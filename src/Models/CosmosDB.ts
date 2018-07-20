import * as crypto from 'crypto';
import * as vscode from 'vscode';
import request = require('request-promise');
import rq = require('request');

export class CosmosDB {
  constructor(
      private _account: string, private _key: string,
      private _channel?: vscode.OutputChannel) {}

  private _getCosmosDBAuthorizationToken(
      verb: string, date: string, resourceType: string, resourceId: string) {
    const key = new Buffer(this._key, 'base64');
    const stringToSign =
        (`${verb}\n${resourceType}\n${resourceId}\n${date}\n\n`).toLowerCase();

    const body = new Buffer(stringToSign, 'utf8');
    const signature =
        crypto.createHmac('sha256', key).update(body).digest('base64');

    const masterToken = 'master';
    const tokenVersion = '1.0';

    return encodeURIComponent(
        `type=${masterToken}&ver=${tokenVersion}&sig=${signature}`);
  }

  private _getRestHeaders(
      verb: string, resourceType: string, resourceId: string) {
    const date = new Date().toUTCString();
    const authorization = this._getCosmosDBAuthorizationToken(
        verb, date, resourceType, resourceId);
    const headers = {
      'Authorization': authorization,
      'Content-Type': 'application/json',
      'x-ms-date': date,
      'x-ms-version': '2017-02-22'
    };

    return headers;
  }

  private async _apiRequest(
      verb: string, path: string, resourceType: string, resourceId: string,
      body: {id: string}|null = null) {
    const apiUrl = `https://${this._account}.documents.azure.com/${path}`;
    const headers = this._getRestHeaders(verb, resourceType, resourceId);
    const apiRes: rq.Response = await request({
      method: verb,
      uri: apiUrl,
      headers,
      encoding: 'utf8',
      body,
      json: true,
      resolveWithFullResponse: true,
      simple: false
    });

    if (this._channel) {
      this._channel.show();
      this._channel.appendLine(JSON.stringify(apiRes, null, 2));
    }
    return apiRes;
  }

  async ensureDatabase(database: string) {
    const getDatabaseRes = await this._apiRequest(
        'GET', `dbs/${database}`, 'dbs', `dbs/${database}`);
    if (getDatabaseRes.statusCode === 200) {
      return true;
    }

    const createDatabaseRes =
        await this._apiRequest('POST', 'dbs', 'dbs', '', {id: database});
    if (createDatabaseRes.statusCode === 201) {
      return true;
    }

    return false;
  }

  async ensureCollection(database: string, collection: string) {
    const databaseRes = await this.ensureDatabase(database);
    if (!databaseRes) {
      return false;
    }

    const getCollectionRes = await this._apiRequest(
        'GET', `dbs/${database}/colls/${collection}`, 'colls',
        `dbs/${database}/colls/${collection}`);
    if (getCollectionRes.statusCode === 200) {
      return true;
    }

    const creatCollectionRes = await this._apiRequest(
        'POST', `dbs/${database}/colls`, 'colls', `dbs/${database}`,
        {id: collection});
    if (creatCollectionRes.statusCode === 201) {
      return true;
    }

    return false;
  }
}