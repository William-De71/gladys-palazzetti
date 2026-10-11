import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readStove } from '../src/palazzetti/stove.js';
import { SCENE_TRIGGERS, buildSceneEvent, describeStove, detectEvents } from '../src/events.js';
import {
  GINGER_ALLS,
  GINGER_STDT,
  JULIE_ALLS,
  JULIE_STDT,
  withFields,
} from './helpers/fixtures.js';

const ginger = (changes) =>
  readStove({ stdt: GINGER_STDT, alls: withFields(GINGER_ALLS, changes) });

test('the first read is the baseline: no event', () => {
  assert.deepEqual(detectEvents(null, ginger({ LSTATUS: 1253 })), []);
});

test('a phase change fires one event, a sub-status change none', () => {
  const events = detectEvents(ginger({ LSTATUS: 0 }), ginger({ LSTATUS: 2 }));
  assert.deepEqual(
    events.map((event) => event.key),
    [SCENE_TRIGGERS.PHASE_CHANGED],
  );
  assert.deepEqual(detectEvents(ginger({ LSTATUS: 2 }), ginger({ LSTATUS: 3 })), []);
  // The periodic brazier cleaning is not a phase change.
  assert.deepEqual(detectEvents(ginger({ LSTATUS: 6 }), ginger({ LSTATUS: 11 })), []);
});

test('an alarm fires on its arrival, on a new code, and when it clears', () => {
  const raised = detectEvents(ginger({ LSTATUS: 6 }), ginger({ LSTATUS: 1253 }));
  assert.deepEqual(
    raised.map((event) => event.key),
    [SCENE_TRIGGERS.PHASE_CHANGED, SCENE_TRIGGERS.ALARM_RAISED],
  );
  const other = detectEvents(ginger({ LSTATUS: 1253 }), ginger({ LSTATUS: 1247 }));
  assert.deepEqual(
    other.map((event) => event.key),
    [SCENE_TRIGGERS.ALARM_RAISED],
  );
  const cleared = detectEvents(ginger({ LSTATUS: 1253 }), ginger({ LSTATUS: 0 }));
  assert.ok(cleared.some((event) => event.key === SCENE_TRIGGERS.ALARM_CLEARED));
});

test('low pellets fire once, when the sensor goes low', () => {
  const julie = (empty) =>
    readStove({ stdt: JULIE_STDT, alls: { ...JULIE_ALLS, PSENSLEMP: empty } });
  assert.deepEqual(
    detectEvents(julie(0), julie(1)).map((event) => event.key),
    [SCENE_TRIGGERS.PELLETS_LOW],
  );
  assert.deepEqual(detectEvents(julie(1), julie(1)), []);
});

test('the event data is flat, filterable and summarized', () => {
  const [, alarm] = detectEvents(ginger({ LSTATUS: 6 }), ginger({ LSTATUS: 1253 }));
  const { key, data } = buildSceneEvent({
    deviceExternalId: 'ext:palazzetti:stove:abc',
    name: 'Salon',
    event: alarm,
    language: 'fr',
  });
  assert.equal(key, SCENE_TRIGGERS.ALARM_RAISED);
  assert.deepEqual(data, {
    stove: 'ext:palazzetti:stove:abc',
    stove_name: 'Salon',
    alarm_type: 'pellet',
    alarm_code: 253,
    alarm_label: 'Plus de pellets',
    summary: 'Salon est en alarme : Plus de pellets.',
  });
  for (const value of Object.values(data)) {
    assert.ok(['string', 'number', 'boolean'].includes(typeof value) || value === null);
  }
  const [phase] = detectEvents(ginger({ LSTATUS: 0 }), ginger({ LSTATUS: 6 }));
  const phaseData = buildSceneEvent({
    deviceExternalId: 'x',
    name: 'Salon',
    event: phase,
    language: 'en',
  }).data;
  assert.equal(phaseData.phase, 'heating');
  assert.equal(phaseData.previous_phase, 'off');
  assert.equal(phaseData.summary, 'Salon: Off → Heating.');
});

test('the connection events carry a summary too', () => {
  const { data } = buildSceneEvent({
    deviceExternalId: 'x',
    name: 'Salon',
    event: { key: SCENE_TRIGGERS.CONNECTION_LOST },
    language: 'de',
  });
  assert.equal(data.summary, 'Salon ist nicht mehr erreichbar.');
});

test('a stove is described in a sentence', () => {
  assert.equal(
    describeStove('Salon', ginger({ LSTATUS: 6 }), 'fr'),
    'Salon : Combustion, 21,5 °C pour une consigne de 21 °C.',
  );
});
