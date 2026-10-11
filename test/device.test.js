import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { readStove } from '../src/palazzetti/stove.js';
import { FEATURE_KEYS, buildDevice, buildStates, parseExternalId } from '../src/device.js';
import { fakeGladys } from './helpers/fakeGladys.js';
import {
  GINGER_ALLS,
  GINGER_CNTR,
  GINGER_STDT,
  HYDRO_ALLS,
  HYDRO_STDT,
  JULIE_ALLS,
  JULIE_STDT,
  WOOD_ALLS,
  WOOD_STDT,
} from './helpers/fixtures.js';

const gladys = fakeGladys();
const ginger = readStove({ stdt: GINGER_STDT, alls: GINGER_ALLS, cntr: GINGER_CNTR });
const julie = readStove({ stdt: JULIE_STDT, alls: JULIE_ALLS });
const hydro = readStove({ stdt: HYDRO_STDT, alls: HYDRO_ALLS });
const wood = readStove({ stdt: WOOD_STDT, alls: WOOD_ALLS });

const keysOf = (device) => device.features.map((feature) => feature.external_id.split(':').pop());

test('the Ginger device carries the features its stove has', () => {
  const device = buildDevice(gladys, {
    id: 'abc',
    host: '192.168.1.40',
    stove: ginger,
    language: 'fr',
  });
  assert.equal(device.name, 'Salon');
  assert.equal(device.external_id, 'ext:palazzetti:stove:abc');
  assert.deepEqual(device.params, [
    { name: 'IP_ADDRESS', value: '192.168.1.40' },
    { name: 'PALAZZETTI_ID', value: 'abc' },
  ]);
  assert.deepEqual(keysOf(device), [
    'mode',
    'setpoint',
    'operating',
    'room',
    'probe-t3',
    'status',
    'alarm',
    'power',
    'fan-main',
    'chrono',
    'pellets',
    'ignitions',
    'heating-hours',
    'service-hours',
  ]);
  const fan = device.features.find((feature) => feature.external_id.endsWith(':fan-main'));
  assert.deepEqual(
    fan.supported_options.map((option) => option.label),
    ['Arrêt', 'Vitesse 1', 'Vitesse 2', 'Vitesse 3', 'Vitesse 4', 'Vitesse 5', 'Maximum', 'Auto'],
  );
  const setpoint = device.features.find((feature) => feature.external_id.endsWith(':setpoint'));
  assert.equal(setpoint.min, 6);
  assert.equal(setpoint.max, 51);
});

test('the other stoves get their fans, water probes and no impossible control', () => {
  const julieKeys = keysOf(buildDevice(gladys, { id: 'j', host: 'h', stove: julie }));
  assert.ok(julieKeys.includes('fan-left') && julieKeys.includes('fan-right'));
  assert.ok(julieKeys.includes('silent') && julieKeys.includes('pellet-empty'));

  const hydroDevice = buildDevice(gladys, { id: 'h', host: 'h', stove: hydro, language: 'en' });
  const room = hydroDevice.features.find((feature) => feature.external_id.endsWith(':room'));
  assert.equal(room.name, 'Regulated water temperature');
  assert.equal(room.type, DEVICE_FEATURE_TYPES.TEMPERATURE_SENSOR.PROBE);
  assert.ok(keysOf(hydroDevice).includes('probe-t1'));
  assert.ok(keysOf(hydroDevice).includes('pellet-level'));
  assert.ok(!keysOf(hydroDevice).includes('pellets'), 'PQT 65535 is no counter');

  const woodKeys = keysOf(buildDevice(gladys, { id: 'w', host: 'h', stove: wood }));
  for (const key of ['mode', 'setpoint', 'power']) {
    assert.ok(!woodKeys.includes(key), `a wood stove has no ${key}`);
  }
});

test('every category, type and unit is one Gladys knows', () => {
  // An unknown one rejects the WHOLE discovered device list in the core.
  const categories = new Set(Object.values(DEVICE_FEATURE_CATEGORIES));
  const types = new Set(
    Object.values(DEVICE_FEATURE_TYPES).flatMap((group) => Object.values(group)),
  );
  const units = new Set(Object.values(DEVICE_FEATURE_UNITS));
  for (const stove of [ginger, julie, hydro, wood]) {
    for (const feature of buildDevice(gladys, { id: 'x', host: 'h', stove }).features) {
      assert.ok(categories.has(feature.category), feature.category);
      assert.ok(types.has(feature.type), feature.type);
      if (feature.unit) {
        assert.ok(units.has(feature.unit), feature.unit);
      }
    }
  }
});

test('supported options follow the core rules: labels set, values unique', () => {
  for (const stove of [ginger, julie, hydro]) {
    for (const feature of buildDevice(gladys, { id: 'x', host: 'h', stove }).features) {
      if (!feature.supported_options) {
        continue;
      }
      const values = feature.supported_options.map((option) => `${option.value}`);
      assert.equal(new Set(values).size, values.length, `${feature.name}: duplicated value`);
      for (const option of feature.supported_options) {
        assert.ok(option.label.trim().length > 0, `${feature.name}: empty label`);
        // String values are only accepted on text/select features.
        if (typeof option.value === 'string') {
          assert.equal(feature.category, DEVICE_FEATURE_CATEGORIES.TEXT);
          assert.equal(feature.type, DEVICE_FEATURE_TYPES.TEXT.SELECT);
        } else {
          assert.ok(Number.isInteger(option.value));
        }
      }
    }
  }
});

test('the states match the features of the device', () => {
  const device = buildDevice(gladys, { id: 'abc', host: 'h', stove: ginger });
  const featureIds = new Set(device.features.map((feature) => feature.external_id));
  const states = buildStates(gladys, 'abc', ginger, 'fr');
  for (const state of states) {
    assert.ok(featureIds.has(state.device_feature_external_id), state.device_feature_external_id);
  }
  const byKey = Object.fromEntries(
    states.map((state) => [
      state.device_feature_external_id.split(':').pop(),
      state.text ?? state.state,
    ]),
  );
  assert.equal(byKey.mode, 1, 'eco standby is "on"');
  assert.equal(byKey.operating, 0, 'but not producing heat');
  assert.equal(byKey.status, 'Mode éco');
  assert.equal(byKey.alarm, 0);
  assert.equal(byKey.power, '3');
  assert.equal(byKey['fan-main'], '6');
  assert.equal(byKey.room, 21.5);
  assert.equal(byKey.pellets, 1807);
});

test('an unknown value is never published as 0', () => {
  const blank = readStove({ stdt: GINGER_STDT, alls: { LSTATUS: 0 } });
  const states = buildStates(gladys, 'abc', blank, 'en');
  const keys = states.map((state) => state.device_feature_external_id.split(':').pop());
  assert.ok(!keys.includes(FEATURE_KEYS.ROOM));
  assert.ok(!keys.includes(FEATURE_KEYS.PELLETS));
  assert.ok(!keys.includes(FEATURE_KEYS.POWER));
});

test('an external id gives back the stove and the feature', () => {
  assert.deepEqual(parseExternalId('ext:palazzetti:stove:40f385712345:fan-main'), {
    id: '40f385712345',
    key: 'fan-main',
  });
  assert.deepEqual(parseExternalId('ext:palazzetti:stove:40f385712345'), {
    id: '40f385712345',
    key: null,
  });
  assert.equal(parseExternalId('ext:other:thing'), null);
});
