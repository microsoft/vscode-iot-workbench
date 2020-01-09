import { crc16xmodem } from 'crc';
import * as fs from 'fs-plus';

export class OTA {
  static generateCrc(filePath: string): {
    crc: string;
    size: number;
} {
    const data = fs.readFileSync(filePath);
    const size = fs.statSync(filePath).size;
    const crc = crc16xmodem(data).toString(16);
    return { crc, size };
  }
}