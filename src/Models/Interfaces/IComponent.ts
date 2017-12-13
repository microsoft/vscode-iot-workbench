namespace IoTStudio {
    export enum ComponentType {
        Device = 1,
        IoTHub,
        AzureFunction
    }

    export interface IComponent{
        load(folderPath: string): boolean;
        save(folderPath: string): boolean;
        getComponentType(): ComponentType;
    }
}