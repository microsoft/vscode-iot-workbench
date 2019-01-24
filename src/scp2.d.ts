declare module "scp2" {

  interface ScpOptions {
      port?: number;
      host?: string;
      username?: string;
      password?: string;
      path?: string;
  }

  export function scp(fileName: string, options: ScpOptions | string, errCallback?: (err: string) => void): void;
  export function scp(fileName: string, options: ScpOptions | string, glob: string, errCallback?: (err: string) => void): void;
}