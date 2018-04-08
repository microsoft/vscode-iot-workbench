// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as http from 'http';
import * as path from 'path';

export class LocalWebServer {
  private app = express();
  private server: http.Server;
  private _serverPort = 0;

  constructor(private _extensionPath: string) {
    this.app.use(
        '/', express.static(path.join(this._extensionPath, './views')));
    this.app.use(bodyParser.json());
    this.server = http.createServer(this.app);
  }

  getServerUrl(): string {
    return `http://localhost:${this._serverPort}`;
  }
  getEndpointUri(type: string): string {
    return `http://localhost:${this._serverPort}/${type}.html`;
  }

  addHandler(
      url: string,
      handler: (req: express.Request, res: express.Response) => void): void {
    this.app.get(url, handler);
  }

  start(): void {
    const port = this.server.listen(0).address().port;
    console.log(`Starting express server on port: ${port}`);
    this._serverPort = port;
  }
}
