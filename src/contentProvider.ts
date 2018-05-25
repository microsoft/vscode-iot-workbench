import * as express from 'express';
import * as vscode from 'vscode';
import request = require('request-promise');

import {ContentView} from './constants';
import {ExampleExplorer} from './exampleExplorer';
import {LocalWebServer} from './localWebServer';

export class ContentProvider implements vscode.TextDocumentContentProvider {
  private _webserver: LocalWebServer;
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();

  constructor(
      private _extensionPath: string,
      private _exampleExplorer: ExampleExplorer) {
    this._webserver = new LocalWebServer(this._extensionPath);
    this.initialize();
    this._webserver.start();
  }

  initialize() {
    this._webserver.addHandler(
        '/api/example', async (req, res) => await this.loadExample(req, res));
    this._webserver.addHandler(
        '/api/link', async (req, res) => await this.openLink(req, res));
    this._webserver.addHandler(
        '/api/feed', async (req, res) => await this.getFeed(req, res));
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    let type = '';
    const url = uri.toString();
    switch (url) {
      case ContentView.workbenchExampleURI:
        type = 'example';
        break;
      default:
        type = 'example';
    }

    const endpoint = this._webserver.getEndpointUri(type) + '?' +
        decodeURIComponent(url.split('?')[1]);

    return `<html>
      <body style="margin: 0; padding: 0; height: 100%; overflow: hidden;">
          <iframe src="${
        endpoint}" width="100%" height="100%" frameborder="0" style="position:absolute; left: 0; right: 0; bottom: 0; top: 0px;"/>
      </body>
      </html>`;
  }

  private async loadExample(req: express.Request, res: express.Response) {
    if (!req.query.name || !req.query.url) {
      return res.json({code: 1});
    }
    const exampleExplorer = this._exampleExplorer;
    exampleExplorer.setSelectedExample(req.query.name, req.query.url);
    await vscode.commands.executeCommand('iotworkbench.exampleInitialize');
    return res.json({code: 0});
  }

  private async openLink(req: express.Request, res: express.Response) {
    if (!req.query.url) {
      return res.json({code: 1});
    }
    await vscode.commands.executeCommand(
        'vscode.open', vscode.Uri.parse(req.query.url));
    return res.json({code: 0});
  }

  private async getFeed(req: express.Request, res: express.Response) {
    if (!req.query.url) {
      return res.json({code: 1});
    }

    const options: request
        .OptionsWithUri = {method: 'GET', uri: req.query.url, encoding: 'utf8'};

    const feed = await request(options).promise() as string;
    return res.send(feed);
  }
}