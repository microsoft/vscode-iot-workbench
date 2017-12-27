import {setTimeout} from 'timers';

export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
