import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readStove } from '../src/palazzetti/stove.js';
import {
  CommandError,
  clockCommand,
  featureCommands,
  readFanValue,
  setpointCommand,
  switchCommand,
} from '../src/commands.js';
import {
  GINGER_ALLS,
  GINGER_STDT,
  JULIE_ALLS,
  JULIE_STDT,
  WOOD_ALLS,
  WOOD_STDT,
  withFields,
} from './helpers/fixtures.js';

const ginger = (changes = {}) =>
  readStove({ stdt: GINGER_STDT, alls: withFields(GINGER_ALLS, changes) });
const julie = readStove({ stdt: JULIE_STDT, alls: JULIE_ALLS });

test('on and off, only when it changes something', () => {
  assert.deepEqual(featureCommands(ginger({ LSTATUS: 0 }), 'mode', 1, 'Salon'), ['CMD ON']);
  assert.deepEqual(featureCommands(ginger({ LSTATUS: 6 }), 'mode', 0, 'Salon'), ['CMD OFF']);
  assert.deepEqual(featureCommands(ginger({ LSTATUS: 6 }), 'mode', 1, 'Salon'), []);
});

test('on/off is refused, with an explanation, during an alarm or an ignition', () => {
  assert.throws(
    () => switchCommand(ginger({ LSTATUS: 1253 }), true, 'Salon'),
    (err) =>
      err instanceof CommandError &&
      /Out of pellets/.test(err.message) &&
      /Plus de pellets/.test(err.translated.fr),
  );
  assert.throws(() => switchCommand(ginger({ LSTATUS: 3 }), false, 'Salon'), /Heating up/);
  const wood = readStove({ stdt: WOOD_STDT, alls: WOOD_ALLS });
  assert.throws(() => switchCommand(wood, true, 'Insert'), /remotely/);
});

test('a setpoint is rounded and kept within the range of the stove', () => {
  assert.deepEqual(setpointCommand(ginger(), 21.4), { command: 'SET SETP 21', value: 21 });
  assert.equal(setpointCommand(ginger(), 2).value, 6);
  assert.equal(setpointCommand(ginger(), 99).value, 51);
  assert.throws(() => setpointCommand(ginger(), 'abc'), CommandError);
});

test('power level and fans accept only what the stove offers', () => {
  assert.deepEqual(featureCommands(ginger(), 'power', '4', 'Salon'), ['SET POWR 4']);
  assert.throws(() => featureCommands(ginger(), 'power', '6', 'Salon'), CommandError);
  assert.deepEqual(featureCommands(ginger(), 'fan-main', '7', 'Salon'), ['SET RFAN 7']);
  assert.deepEqual(featureCommands(julie, 'fan-left', '2', 'Séjour'), ['SET FN3L 2']);
  assert.deepEqual(featureCommands(julie, 'fan-right', '0', 'Séjour'), ['SET FN4L 0']);
  // The Julie has auto but no "high".
  assert.throws(() => featureCommands(julie, 'fan-main', '6', 'Séjour'), CommandError);
  // No left fan on the Ginger.
  assert.throws(() => featureCommands(ginger(), 'fan-left', '1', 'Salon'), CommandError);
});

test('silent mode, schedule, and read-only features', () => {
  assert.deepEqual(featureCommands(julie, 'silent', 1, 'Séjour'), ['SET SLNT 1']);
  assert.throws(() => featureCommands(ginger(), 'silent', 1, 'Salon'), CommandError);
  assert.deepEqual(featureCommands(ginger(), 'chrono', 1, 'Salon'), ['SET CSST 1']);
  assert.throws(() => featureCommands(ginger(), 'room', 20, 'Salon'), /read-only/);
});

test('fan values are read from scenes as names or numbers', () => {
  assert.equal(readFanValue('auto'), 7);
  assert.equal(readFanValue('High'), 6);
  assert.equal(readFanValue('off'), 0);
  assert.equal(readFanValue('3'), 3);
  assert.equal(readFanValue('fast'), null);
});

test('the clock command is the local time of the container', () => {
  assert.equal(clockCommand(new Date(2026, 9, 12, 8, 5, 9)), 'SET TIME 2026-10-12 08:05:09');
});
