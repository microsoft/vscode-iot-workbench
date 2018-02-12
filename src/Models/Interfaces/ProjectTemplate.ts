
export enum ProjectTemplateType {
  basic = 1,
  IotHub,
  Function
}

export interface ProjectTemplate {
  label: string;
  detail: string;
  description: string;
  type: number;
  sketch: string;
}
