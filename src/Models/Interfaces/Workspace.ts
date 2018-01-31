export interface Workspace {
  folders: Array<{path: string}>;
  settings: {[key: string]: string};
}