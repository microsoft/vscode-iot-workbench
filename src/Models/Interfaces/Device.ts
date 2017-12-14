import {Component} from './Component'
import {Compilable} from './Compilable'
import {Uploadable} from './Uploadable'

export enum DeviceType {
    MXChip_AZ3166 = 1
}

export interface Device extends Component, Compilable, Uploadable{
    getDeviceType(): DeviceType;
}
