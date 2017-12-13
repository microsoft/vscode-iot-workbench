namespace IoTStudio {
    export enum DeviceType {
        MXChip_AZ3166 = 1
    }

    export interface IDeivce extends IComponent, ICompilable, IUploadable{
        getDeviceType(): DeviceType;
    }
}