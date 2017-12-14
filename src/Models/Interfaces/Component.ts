export enum ComponentType {
    Device = 1,
    IoTHub,
    AzureFunction
}

export interface Component{
    load(folderPath: string): boolean;
    save(folderPath: string): boolean;
    getComponentType(): ComponentType;
}
