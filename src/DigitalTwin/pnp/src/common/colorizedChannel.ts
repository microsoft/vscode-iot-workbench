// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";

/**
 * Output channel with colorized message
 */
export class ColorizedChannel {
  /**
   * format message for operation or error
   * @param operation user operation
   * @param error error
   */
  static formatMessage(operation: string, error?: Error): string {
    if (error) {
      const message: string =
        operation.charAt(0).toLowerCase() + operation.slice(1);
      return `Fail to ${message}. Error: ${error.message}`;
    } else {
      return `${operation} successfully`;
    }
  }

  /**
   * create message tag of component name
   * @param name component name
   */
  private static createTag(name: string | undefined): string {
    return name ? `[${name}]` : "";
  }

  private channel: vscode.OutputChannel;
  constructor(name: string) {
    this.channel = vscode.window.createOutputChannel(name);
  }

  /**
   * Output message of user operation start
   * @param operation user operation
   * @param component component name
   */
  start(operation: string, component?: string): void {
    const tag: string = ColorizedChannel.createTag(component);
    this.channel.appendLine(`[Start]${tag} ${operation}`);
  }

  /**
   * Output message of user operation end
   * @param operation user operation
   * @param component component name
   */
  end(operation: string, component?: string): void {
    const tag: string = ColorizedChannel.createTag(component);
    this.channel.appendLine(
      `[Done]${tag} ${ColorizedChannel.formatMessage(operation)}`
    );
  }

  /**
   * Output info message (color: default)
   * @param operation message
   */
  info(message: string): void {
    this.channel.appendLine(message);
  }

  /**
   * Output warn message (color: yellow)
   * @param operation message
   * @param component component name
   */
  warn(message: string, component?: string): void {
    const tag: string = ColorizedChannel.createTag(component);
    this.channel.appendLine(`[Warn]${tag} ${message}`);
  }

  /**
   * Output error message of operation or error (color: red)
   * @param operation user operation
   * @param component component name
   * @param error error
   */
  error(operation: string, component?: string, error?: Error): void {
    const tag: string = ColorizedChannel.createTag(component);
    const message: string = error
      ? ColorizedChannel.formatMessage(operation, error)
      : operation;
    this.channel.appendLine(`[Error]${tag} ${message}`);
  }

  /**
   * show channel
   */
  show(): void {
    this.channel.show();
  }

  /**
   * dispose channel
   */
  dispose(): void {
    if (this.channel) {
      this.channel.dispose();
    }
  }
}
