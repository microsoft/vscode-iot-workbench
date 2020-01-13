// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export interface Workspace {
  folders: Array<{ path: string }>;
  settings: { [key: string]: string };
}
