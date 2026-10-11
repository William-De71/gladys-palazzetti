import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readStove } from '../src/palazzetti/stove.js';
import { CommandError } from '../src/commands.js';
import { buildControlOutputs, buildStatusOutputs, planControl } from '../src/scene-actions.js';
import { GINGER_ALLS, GINGER_CNTR, GINGER_STDT, withFields } from './helpers/fixtures.js';

const ginger = (changes = {}) =>
  readStove({ stdt: GINGER_STDT, alls: withFields(GINGER_ALLS, changes), cntr: GINGER_CNTR });

test('get_status outputs are scalars and summarized', () => {
  const outputs = buildStatusOutputs('Salon', ginger({ LSTATUS: 6 }), 'fr');
  assert.equal(outputs.on, true);
  assert.equal(outputs.heating, true);
  assert.equal(outputs.phase, 'heating');
  assert.equal(outputs.status_label, 'Combustion');
  assert.equal(outputs.temperature, 21.5);
  assert.equal(outputs.fan, 'Maximum');
  assert.equal(outputs.pellets_consumed, 1807);
  assert.match(outputs.summary, /^Salon : Combustion/);
  for (const value of Object.values(outputs)) {
    assert.ok(['string', 'number', 'boolean'].includes(typeof value) || value === null);
  }
});

test('control: settings first, on/off last, only what changes', () => {
  const plan = planControl(
    ginger({ LSTATUS: 0 }),
    { power: 'on', setpoint: 22, power_level: '3', fan: 'auto' },
    'Salon',
  );
  // Power 3 is already set: not sent again.
  assert.deepEqual(plan.commands, ['SET SETP 22', 'SET RFAN 7', 'CMD ON']);
  assert.deepEqual(plan.changes('fr'), ['consigne 22 °C', 'ventilation Auto', 'allumage demandé']);
});

test('control: empty fields and "unchanged" send nothing', () => {
  const plan = planControl(
    ginger(),
    { power: 'unchanged', setpoint: '', power_level: null },
    'Salon',
  );
  assert.deepEqual(plan.commands, []);
  const outputs = buildControlOutputs('Salon', plan.changes('en'), ginger(), 'en');
  assert.deepEqual(outputs, { changed: false, phase: 'eco', summary: 'Salon: nothing to change.' });
});

test('control: a refused value fails the action before anything is sent', () => {
  assert.throws(
    () => planControl(ginger(), { setpoint: 21, power_level: '9' }, 'Salon'),
    CommandError,
  );
  assert.throws(
    () => planControl(ginger({ LSTATUS: 1253 }), { power: 'on' }, 'Salon'),
    CommandError,
  );
});
