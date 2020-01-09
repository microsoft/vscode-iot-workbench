// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import { FileNames } from './constants';
import { Board } from './Models/Interfaces/Board';
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
  private boardFolderPath: string;
  constructor(boardFolderPath: string) {
    this.boardFolderPath = boardFolderPath;
  }

  get list(): Board[] {
    const boardList =
        path.join(this.boardFolderPath, FileNames.boardListFileName);
    const boardsJson: BoardList = require(boardList);
    return boardsJson.boards;
  }

  find(option: BoardOption): Board|undefined {
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
          const boardId = Number(`0x${boardProperty.value}`);
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