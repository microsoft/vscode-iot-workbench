import * as vscode from "vscode";
import * as WinReg from "winreg";

export function getRegistryValues(hive: string, key: string, name: string): Promise<string> {
  return new Promise((resolve, reject) => {
      try {
          const regKey = new WinReg({
              hive,
              key,
          });

          regKey.valueExists(name, (e, exists) => {
              if (e) {
                  return reject(e);
              }
              if (exists) {
                  regKey.get(name, (err, result) => {
                      if (!err) {
                          resolve(result ? result.value : "");
                      } else {
                          reject(err);
                      }
                  });
              } else {
                  resolve("");
              }
          });
      } catch (ex) {
          reject(ex);
      }
  });
}