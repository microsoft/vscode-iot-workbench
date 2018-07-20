export interface SimulateFile {
  Message?: MessageSend;
  Twin?: DeviceTwin;
  Receive?: DeviceReceive;
}

export interface MessageSend {
  Content: string;
  Interval: number;
  Variable?: MessageVariable[];
}

export interface MessageVariable {
  Name: string;
  Min?: number;
  Max?: number;
  Digits?: number;
  Equal?: number;
}

export interface DeviceTwin { Report?: DeviceReport; }

export interface DeviceReport {
  Content?: {};
  Variable?: MessageVariable[];
  Interval?: number;
}

export interface DeviceReportProperty {
  ChildProperty?: DeviceReportProperty[];
  Property?: string[];
}

export interface DeviceReceive {
  Message?: DeviceReceiveAction;
  Twin?: DeviceReceiveAction;
}

export interface DeviceReceiveAction {
  Equal?: ActionPair[];
  Smaller?: ActionPair[];
  Larger?: ActionPair[];
}


export interface ActionPair {
  Property?: string;
  Value?: string;
  Send?: string;
}