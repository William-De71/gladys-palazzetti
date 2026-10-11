import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_CONFIG, POLL_INTERVAL_BOUNDS } from '../src/config.js';
import { ALARM_TYPES, DISCOVERY_PORT, PHASES } from '../src/palazzetti/constants.js';
import { SCENE_TRIGGERS } from '../src/events.js';
import { SCENE_ACTIONS, SWITCH_VALUES } from '../src/scene-actions.js';
import { CONSUMPTION_DAYS, WIDGETS } from '../src/widgets.js';
import { readFanValue } from '../src/commands.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url)),
);
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const keys = (list) => list.map((entry) => entry.key).sort();
const field = (list, key) => list.find((entry) => entry.key === key);

test('the manifest declares the fields Gladys requires', () => {
  for (const name of [
    'manifest_version',
    'type',
    'name',
    'version',
    'docker_image',
    'gladys_version',
  ]) {
    assert.ok(manifest[name], `${name} is required`);
  }
  assert.equal(manifest.manifest_version, 1);
  assert.equal(manifest.type, 'device');
  assert.deepEqual(manifest.transports, ['local']);
});

test('the manifest respects the length limits Gladys enforces', () => {
  // Gladys rejects the whole manifest — with a generic "invalid manifest"
  // message — when these bounds are exceeded, so they are worth pinning.
  assert.ok(manifest.name.length >= 3 && manifest.name.length <= 30);
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
  for (const widget of manifest.widgets) {
    for (const [lang, text] of Object.entries(widget.label)) {
      assert.ok(text.length >= 3 && text.length <= 30, `${widget.key}.label.${lang}`);
    }
  }
  for (const action of [...manifest.actions, ...manifest.scene_actions]) {
    assert.ok(action.timeout_seconds >= 5 && action.timeout_seconds <= 120, action.key);
  }
});

test('the version, the image tag and the cover follow the repository', () => {
  assert.equal(manifest.version, pkg.version);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  // The release workflow keeps the image tag in lockstep with the version.
  assert.equal(manifest.docker_image, `ghcr.io/william-de71/gladys-palazzetti:${manifest.version}`);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/William-De71/gladys-palazzetti/main/cover.jpg',
  );
});

test('the declared UDP capture is the one the code scans', () => {
  // An undeclared capture is rejected by the core with a 403.
  assert.deepEqual(manifest.network_discovery, [
    { type: 'udp-active-broadcast', ports: [DISCOVERY_PORT] },
  ]);
});

test('the config defaults and bounds agree with the code', () => {
  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    assert.equal(field(manifest.config_schema, key).default, value, key);
  }
  const poll = field(manifest.config_schema, 'poll_interval');
  assert.equal(poll.min, POLL_INTERVAL_BOUNDS.min);
  assert.equal(poll.max, POLL_INTERVAL_BOUNDS.max);
  const days = field(field(manifest.widgets, WIDGETS.CONSUMPTION).settings, 'days');
  assert.deepEqual(
    [days.min, days.max, days.default],
    [CONSUMPTION_DAYS.min, CONSUMPTION_DAYS.max, CONSUMPTION_DAYS.default],
  );
});

test('every scene trigger, scene action and widget has its handler', () => {
  // Keys are forever: a renamed key is a removed key for every scene using it.
  assert.deepEqual(keys(manifest.scene_triggers), Object.values(SCENE_TRIGGERS).sort());
  assert.deepEqual(keys(manifest.scene_actions), Object.values(SCENE_ACTIONS).sort());
  assert.deepEqual(keys(manifest.widgets), Object.values(WIDGETS).sort());
});

test('the filter options are the values the events carry', () => {
  const phases = field(
    field(manifest.scene_triggers, SCENE_TRIGGERS.PHASE_CHANGED).fields,
    'phase',
  );
  assert.deepEqual(
    phases.options.map((option) => option.value).sort(),
    Object.values(PHASES)
      .filter((phase) => phase !== PHASES.UNKNOWN)
      .sort(),
  );
  const alarms = field(
    field(manifest.scene_triggers, SCENE_TRIGGERS.ALARM_RAISED).fields,
    'alarm_type',
  );
  assert.deepEqual(
    alarms.options.map((option) => option.value).sort(),
    Object.values(ALARM_TYPES).sort(),
  );
});

test('every option of the control action is understood by the code', () => {
  const control = field(manifest.scene_actions, SCENE_ACTIONS.CONTROL);
  assert.deepEqual(
    field(control.fields, 'power')
      .options.map((option) => option.value)
      .sort(),
    Object.values(SWITCH_VALUES).sort(),
  );
  for (const option of field(control.fields, 'fan').options) {
    assert.notEqual(readFanValue(option.value), null, option.value);
  }
});

test('every scene trigger and action can target a stove', () => {
  for (const declaration of [...manifest.scene_triggers, ...manifest.scene_actions]) {
    const stove = field(declaration.fields, 'stove');
    assert.ok(stove, `${declaration.key}: a stove field`);
    assert.equal(stove.source, 'devices');
    assert.equal(stove.required, false);
  }
});

test('every config field carries the parts the Configuration screen renders', () => {
  for (const entry of manifest.config_schema) {
    assert.ok(entry.label?.en, `${entry.key}: an en label is mandatory`);
    if (entry.type === 'section') {
      assert.equal(entry.required, undefined);
      assert.equal(entry.default, undefined);
    }
    for (const link of entry.links || []) {
      assert.ok(link.url.startsWith('https://'));
    }
    for (const text of Object.values(entry.description || {})) {
      assert.ok(text.length <= 1000);
    }
  }
});

test('every text of the manifest exists in the four languages of Gladys', () => {
  // A field translated in English only shows up in English in a German
  // interface; this keeps a new field from shipping half-translated.
  const missing = [];
  const walk = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((entry, index) => walk(entry, `${path}[${index}]`));
      return;
    }
    if (!node || typeof node !== 'object') {
      return;
    }
    if (typeof node.en === 'string') {
      for (const language of ['en', 'fr', 'de', 'es']) {
        if (typeof node[language] !== 'string' || node[language].trim() === '') {
          missing.push(`${path}.${language}`);
        }
      }
      return;
    }
    Object.entries(node).forEach(([key, value]) => walk(value, `${path}.${key}`));
  };
  walk(manifest, '$');
  assert.deepEqual(missing, []);
});

test('the user documentation exists in the four languages of Gladys', () => {
  for (const language of ['en', 'fr', 'de', 'es']) {
    const doc = readFileSync(new URL(`../docs/${language}.md`, import.meta.url), 'utf-8');
    assert.ok(doc.length > 1000, `docs/${language}.md looks empty`);
  }
});

test('the repository ships the license package.json declares', () => {
  assert.equal(pkg.license, 'Apache-2.0');
  const license = readFileSync(new URL('../LICENSE', import.meta.url), 'utf-8');
  assert.match(license, /Apache License\s+Version 2\.0/);
});
