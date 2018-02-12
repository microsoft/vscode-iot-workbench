import { MessageItem } from 'vscode';

export namespace DialogResponses {
    export const skipForNow: MessageItem = { title:  'Skip for now' };
    export const yes: MessageItem = { title: 'Yes'};
    export const no: MessageItem = { title: 'No'};
    export const cancel: MessageItem = { title: 'Cancel', isCloseAffordance: true };
}