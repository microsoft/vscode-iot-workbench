import * as os from 'os';
import * as path from 'path';


export class IoTDevSettings {
  private _projectsPath: string;

  constructor() {
    const platform = os.platform();
    if (platform === 'win32') {
      this._projectsPath =
          path.join(process.env.USERPROFILE, 'Documents', 'IoTProjects');
    } else if (platform === 'linux') {
      this._projectsPath = path.join(process.env.HOME, 'IoTProjects');
    } else if (platform === 'darwin') {
      this._projectsPath =
          path.join(process.env.HOME, 'Documents', 'IoTProjects');
    }
  }

  get defaultProjectsPath(): string {
    return this._projectsPath;
  }
}
