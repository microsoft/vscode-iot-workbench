// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import * as vscode from 'vscode';
import {FileNames} from './constants';
import {Board} from './Models/Interfaces/Board';
import * as path from 'path';

interface BoardList {
  boards: Board[];
}

export interface BoardOption {
  name?: string;
  id?: string;
  platform?: string;
  defaultBaudRate?: number;
  vendorId?: string|number;
  productId?: string|number;
}

export class BoardProvider {
  constructor(private context: vscode.ExtensionContext) {}

  get list() {
    const boardList = this.context.asAbsolutePath(
        path.join(FileNames.resourcesFolderName, FileNames.boardListFileName));
    const boardsJson: BoardList = require(boardList);
    return boardsJson.boards;
  }

  find(option: BoardOption) {
    const list = this.list;
    return list.find(board => {
      for (const key of Object.keys(option)) {
        const boardProperty = Object.getOwnPropertyDescriptor(board, key);
        const optionProperty = Object.getOwnPropertyDescriptor(option, key);

        if (!optionProperty) {
          continue;
        }

        if (!boardProperty) {
          return false;
        }

        if (key === 'vendorId' || key === 'productId') {
          const optionId = typeof optionProperty.value === 'number' ?
              optionProperty.value :
              Number(`0x${optionProperty.value}`);
          const boardId = Number(`0x${optionProperty.value}`);
          if (optionId !== boardId) {
            return false;
          }
        } else if (optionProperty.value !== boardProperty.value) {
          return false;
        }
      }
      return true;
    });
  }
}