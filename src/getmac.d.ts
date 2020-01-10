// reference code from https://github.com/0815fox/DefinitelyTyped

declare module "getmac" {
  function getMac(opts: (err: Error, macAddress: string) => void): void;
  function isMac(macAddress: string): boolean;
}
