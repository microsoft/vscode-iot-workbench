declare module 'scp' {
  export interface ScpOptions {
    file: string,
    user?: string,
    host: string,
    port?: number,
    path: string
  }
  export function send(options: ScpOptions, cb: (err:Error) => void): void;
}