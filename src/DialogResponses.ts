// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { MessageItem } from "vscode";

export class DialogResponses {
  static skipForNow: MessageItem = { title: "Skip for now" };
  static all: MessageItem = { title: "All" };
  static yes: MessageItem = { title: "Yes" };
  static no: MessageItem = { title: "No" };
  static cancel: MessageItem = { title: "Cancel", isCloseAffordance: true };
}
