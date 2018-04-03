import * as express from 'express';
import * as vscode from 'vscode';

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
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    let type = '';
    switch (uri.toString()) {
      case ContentView.workbenchExampleURI:
        type = 'example';
        break;
      default:
        type = 'example';
    }

    return `<html>
      <body style="margin: 0; padding: 0; height: 100%; overflow: hidden;">
          <iframe src="${
        this._webserver.getEndpointUri(
            type)}" width="100%" height="100%" frameborder="0" style="position:absolute; left: 0; right: 0; bottom: 0; top: 0px;"/>
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
}