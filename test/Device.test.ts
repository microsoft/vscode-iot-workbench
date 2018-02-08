import * as assert from 'assert';
import * as Path from 'path';
import * as vscode from 'vscode';

import {AZ3166Device, AZ3166SketchType} from '../src/Models/AZ3166Device';
import {ComponentType} from '../src/Models/Interfaces/Component';
import {Device, DeviceType} from '../src/Models/Interfaces/Device';

import {TestExtensionContext} from './stub';

suite('IoT Dev Env: AZ3166Device', () => {
  // tslint:disable-next-line: only-arrow-functions
  test('property of AZ3166 device should be set correctly', function(done) {
    const context = new TestExtensionContext();
    const device = new AZ3166Device(context, '', AZ3166SketchType.emptySketch);
    assert.equal(device.getDeviceType(), DeviceType.MXChip_AZ3166);
    assert.equal(device.getComponentType(), ComponentType.Device);
    done();
  });
});