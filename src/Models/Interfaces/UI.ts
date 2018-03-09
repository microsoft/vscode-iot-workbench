import {QuickPickItem} from 'vscode';

export interface PickWithData<T> extends QuickPickItem { data: T; }