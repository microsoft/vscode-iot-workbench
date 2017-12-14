declare namespace IoTStudio {
    export enum DeviceType {
        MXChip_AZ3166 = 1
    }

    export interface Deivce extends Component, Compilable, Uploadable{
        getDeviceType(): DeviceType;
    }
}