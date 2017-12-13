namespace IoTStudio {
    export class AZ3166Device implements IDeivce
    {
        private deviceType: DeviceType;
        private componentType : ComponentType;

        public constructor () {
            this.deviceType = DeviceType.MXChip_AZ3166;
            this.componentType = ComponentType.Device;
        }
        
        public getDeviceType() : DeviceType {
            return this.deviceType;
        }

        public getComponentType(): ComponentType{
            return this.componentType;
        }

        public load(folderPath: string): boolean{
            return true;
        }

        public save(folderPath: string): boolean{
            return true;
        }

        public compile() :boolean {
            return true;
        }

        public upload() :boolean {
            return true;
        }

    }
}