
export enum ProjectTemplateType {
  Basic = 1,
  IotHub,
  Function
}

export interface ProjectTemplate {
  label: string;
  detail: string;
  description: string;
  type: string;
  sketch: string;
}
