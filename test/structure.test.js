// -----------------------------------------------------------------------------
// Structure non-regression: what users of 1.0.1 already created must keep its
// meaning.
//
// The discovery "Update" button of Gladys compares the forever fields of each
// feature (external_id, category, type, unit, min, max); a change there forces
// the user to delete and recreate a device, losing its history and its scenes.
// Scenes and dashboards store the keys of the widgets, of their settings, of
// the scene triggers and actions, of their fields, variables and outputs.
//
// test/fixtures/discovery.baseline.json was generated from the v1.0.1 code,
// before any change of this version, from the four stoves of
// test/helpers/fixtures.js (Ginger with its counters, Julie with three fans,
// a hydro stove, a wood stove). test/fixtures/manifest.baseline.json holds the
// keys of the manifest of 1.0.1. A difference is a breaking change: it needs
// an entry in ALLOWED_CHANGES with its migration, in the changelog, the docs
// and the forum message.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDevice } from '../src/device.js';
import { readStove } from '../src/palazzetti/stove.js';
import { fakeGladys } from './helpers/fakeGladys.js';
import * as fixtures from './helpers/fixtures.js';

const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const baseline = read('test/fixtures/discovery.baseline.json');
const manifestBaseline = read('test/fixtures/manifest.baseline.json');
const manifest = read('gladys-assistant-integration.json');

// No allowed change in this version.
const ALLOWED_CHANGES = [];

const FOREVER_FEATURE_FIELDS = [
  'external_id',
  'category',
  'type',
  'unit',
  'min',
  'max',
  'read_only',
  'has_feedback',
];

const STOVES = {
  ginger: () =>
    readStove({
      stdt: fixtures.GINGER_STDT,
      alls: fixtures.GINGER_ALLS,
      cntr: fixtures.GINGER_CNTR,
    }),
  julie: () => readStove({ stdt: fixtures.JULIE_STDT, alls: fixtures.JULIE_ALLS }),
  hydro: () => readStove({ stdt: fixtures.HYDRO_STDT, alls: fixtures.HYDRO_ALLS }),
  wood: () => readStove({ stdt: fixtures.WOOD_STDT, alls: fixtures.WOOD_ALLS }),
};

/**
 * Build the devices of the baseline stoves with the current code.
 * @returns {object[]} The devices, as discovery publishes them.
 */
function currentDevices() {
  const gladys = fakeGladys('ext-palazzetti');
  return baseline.stoves.map((id) =>
    buildDevice(gladys, { id, host: '192.168.1.40', stove: STOVES[id](), language: 'en' }),
  );
}

const keys = (list) => (list || []).map((entry) => entry.key);

test('the devices of 1.0.1 keep their external id, params and polling', () => {
  const now = currentDevices();
  assert.equal(now.length, baseline.devices.length);
  baseline.devices.forEach((before, index) => {
    assert.equal(now[index].external_id, before.external_id);
    assert.deepEqual(
      now[index].params.map((param) => param.name),
      before.params.map((param) => param.name),
    );
    assert.equal(now[index].should_poll, before.should_poll);
  });
  assert.deepEqual(ALLOWED_CHANGES, []);
});

test('every feature of 1.0.1 is still discovered with the same forever fields', () => {
  const now = currentDevices();
  baseline.devices.forEach((before, index) => {
    const features = new Map(now[index].features.map((feature) => [feature.external_id, feature]));
    for (const feature of before.features) {
      const current = features.get(feature.external_id);
      assert.ok(current, `feature ${feature.external_id} disappeared`);
      for (const field of FOREVER_FEATURE_FIELDS) {
        assert.deepEqual(current[field], feature[field], `${feature.external_id}.${field}`);
      }
    }
  });
});

test('no feature id is published twice on one device', () => {
  for (const device of currentDevices()) {
    const ids = device.features.map((feature) => feature.external_id);
    assert.equal(new Set(ids).size, ids.length, device.external_id);
  }
});

test('the configuration and action keys of 1.0.1 are kept, with their types', () => {
  const current = new Map(manifest.config_schema.map((field) => [field.key, field]));
  for (const field of manifestBaseline.config_schema) {
    const now = current.get(field.key);
    assert.ok(now, `config_schema.${field.key} was removed`);
    assert.equal(now.type, field.type, `config_schema.${field.key}.type`);
    assert.equal(now.required ?? false, field.required, `config_schema.${field.key}.required`);
    assert.equal(now.default, field.default, `config_schema.${field.key}.default`);
  }
  const oldKeys = new Set(manifestBaseline.config_schema.map((field) => field.key));
  for (const field of manifest.config_schema.filter((entry) => !oldKeys.has(entry.key))) {
    // A new required field without a default would block every existing user.
    assert.ok(!field.required || field.default !== undefined, `new required ${field.key}`);
  }
  for (const key of manifestBaseline.actions) {
    assert.ok(keys(manifest.actions).includes(key), `action ${key}`);
  }
});

test('the widget, scene trigger and scene action keys of 1.0.1 are kept', () => {
  const widgets = new Map(manifest.widgets.map((widget) => [widget.key, widget]));
  for (const widget of manifestBaseline.widgets) {
    assert.ok(widgets.has(widget.key), `widget ${widget.key}`);
    for (const setting of widget.settings) {
      assert.ok(
        keys(widgets.get(widget.key).settings).includes(setting),
        `${widget.key}.${setting}`,
      );
    }
  }
  const triggers = new Map(manifest.scene_triggers.map((trigger) => [trigger.key, trigger]));
  for (const trigger of manifestBaseline.scene_triggers) {
    const now = triggers.get(trigger.key);
    assert.ok(now, `scene trigger ${trigger.key}`);
    for (const field of trigger.fields) {
      assert.ok(keys(now.fields).includes(field), `${trigger.key} field ${field}`);
    }
    for (const variable of trigger.variables) {
      assert.ok(keys(now.variables).includes(variable), `${trigger.key} variable ${variable}`);
    }
  }
  const actions = new Map(manifest.scene_actions.map((action) => [action.key, action]));
  for (const action of manifestBaseline.scene_actions) {
    const now = actions.get(action.key);
    assert.ok(now, `scene action ${action.key}`);
    for (const field of action.fields) {
      assert.ok(keys(now.fields).includes(field), `${action.key} field ${field}`);
    }
    for (const output of action.outputs) {
      assert.ok(keys(now.outputs).includes(output), `${action.key} output ${output}`);
    }
  }
});

test('the type, the transport and the network discovery of 1.0.1 are kept', () => {
  assert.equal(manifest.type, manifestBaseline.type);
  assert.deepEqual(manifest.transports, manifestBaseline.transports);
  assert.deepEqual(manifest.network_discovery, manifestBaseline.network_discovery);
});
