import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALARM_TYPES,
  PHASES,
  alarmCodeOf,
  alarmTypeOf,
  phaseOf,
} from '../src/palazzetti/constants.js';
import { fanValues, mainProbe, pelletsLow, readHours, readStove } from '../src/palazzetti/stove.js';
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
  withFields,
} from './helpers/fixtures.js';

test('the statuses are grouped into phases', () => {
  assert.equal(phaseOf(0), PHASES.OFF);
  assert.equal(phaseOf(3), PHASES.IGNITION);
  assert.equal(phaseOf(6), PHASES.HEATING);
  // The periodic brazier cleaning happens while burning: still heating.
  assert.equal(phaseOf(11), PHASES.HEATING);
  assert.equal(phaseOf(51), PHASES.ECO);
  assert.equal(phaseOf(12), PHASES.COOLING);
  assert.equal(phaseOf(50), PHASES.CLEANING);
  assert.equal(phaseOf(1253), PHASES.ALARM);
  assert.equal(phaseOf(253), PHASES.ALARM);
  assert.equal(phaseOf(42), PHASES.UNKNOWN);
  assert.equal(phaseOf(undefined), PHASES.UNKNOWN);
});

test('an alarm keeps its 2xx code and gets a family', () => {
  assert.equal(alarmCodeOf(1253), 253);
  assert.equal(alarmCodeOf(1000), 1000);
  assert.equal(alarmCodeOf(6), null);
  assert.equal(alarmTypeOf(253), ALARM_TYPES.PELLET);
  assert.equal(alarmTypeOf(247), ALARM_TYPES.DOOR);
  assert.equal(alarmTypeOf(241), ALARM_TYPES.CLEANING);
  assert.equal(alarmTypeOf(1000), ALARM_TYPES.OTHER);
});

test('the Ginger: eco standby, room probe T1, main fan with high and auto', () => {
  const stove = readStove({ stdt: GINGER_STDT, alls: GINGER_ALLS, cntr: GINGER_CNTR });
  assert.equal(stove.name, 'Salon');
  assert.equal(stove.status, 51);
  assert.equal(stove.phase, PHASES.ECO);
  assert.equal(stove.running, true);
  assert.equal(stove.heating, false);
  assert.equal(stove.canSwitch, true);
  assert.equal(stove.mainTemperature, 21.5);
  assert.equal(stove.mainProbe.water, false);
  assert.equal(stove.setpoint, 21);
  assert.equal(stove.setpointMin, 6);
  assert.equal(stove.power, 3);
  assert.deepEqual(stove.fans.main, { value: 6, min: 0, max: 5, high: true, auto: true });
  assert.equal(stove.fans.left, null);
  assert.equal(stove.fans.right, null);
  assert.equal(stove.hasSilent, false);
  assert.equal(stove.hasChrono, true);
  assert.equal(stove.chrono, false);
  assert.equal(stove.pelletsConsumed, 1807);
  assert.equal(stove.ignitions, 812);
  assert.equal(stove.heatingHours, 1520);
  assert.equal(stove.serviceHours, 312);
  assert.equal(pelletsLow(stove), null);
});

test('the Julie Pro 2: three fans, room probe T5, capacitive pellet sensor', () => {
  const stove = readStove({ stdt: JULIE_STDT, alls: JULIE_ALLS });
  assert.equal(stove.mainProbe.field, 'T5');
  assert.equal(stove.mainTemperature, 18.4);
  assert.deepEqual(fanValues(stove.fans.main), [0, 1, 2, 3, 4, 5, 7]);
  assert.equal(stove.fans.left.value, 0);
  assert.equal(stove.fans.right.value, 3);
  assert.equal(stove.hasSilent, true);
  assert.equal(stove.chrono, true);
  assert.equal(pelletsLow(stove), false);
  assert.equal(
    pelletsLow(readStove({ stdt: JULIE_STDT, alls: { ...JULIE_ALLS, PSENSLEMP: 1 } })),
    true,
  );
});

test('a hydro stove regulating on the return water exposes it as water', () => {
  assert.deepEqual(mainProbe(HYDRO_STDT), { field: 'T2', water: true });
  const stove = readStove({ stdt: HYDRO_STDT, alls: HYDRO_ALLS });
  assert.equal(stove.hydro, true);
  assert.equal(stove.mainTemperature, 55.1);
  assert.equal(stove.fans.main, null);
  // 65535 = the board does not count the pellets.
  assert.equal(stove.pelletsConsumed, null);
  assert.equal(stove.pelletLevel, 30);
  assert.equal(pelletsLow(stove), false);
  assert.equal(
    pelletsLow(readStove({ stdt: HYDRO_STDT, alls: { ...HYDRO_ALLS, PLEVEL: 10 } })),
    true,
  );
});

test('a wood stove cannot be switched and has no setpoint nor power', () => {
  const stove = readStove({ stdt: WOOD_STDT, alls: WOOD_ALLS });
  assert.equal(stove.hasSwitch, false);
  assert.equal(stove.canSwitch, false);
  assert.equal(stove.hasSetpoint, false);
  assert.equal(stove.hasPower, false);
  assert.equal(stove.phase, PHASES.HEATING);
});

test('on/off is refused during an ignition', () => {
  const stove = readStove({ stdt: GINGER_STDT, alls: withFields(GINGER_ALLS, { LSTATUS: 3 }) });
  assert.equal(stove.phase, PHASES.IGNITION);
  assert.equal(stove.canSwitch, false);
});

test('a probe at 0 is an absent probe, never a 0 °C reading', () => {
  const stove = readStove({ stdt: GINGER_STDT, alls: withFields(GINGER_ALLS, { T1: 0 }) });
  assert.equal(stove.mainTemperature, null);
});

test('the counters are read in every shape the boards use', () => {
  assert.equal(readHours({ HEATTIME: '1520:42' }, 'HEATTIME'), 1520);
  assert.equal(readHours({ HEATTIME: 88 }, 'HEATTIME'), 88);
  assert.equal(readHours({ HEATTIMEH: 12, HEATTIMEM: 30 }, 'HEATTIME'), 12);
  assert.equal(readHours({}, 'HEATTIME'), null);
});

test('a missing or broken FANLMINMAX falls back to the usual range', () => {
  const stove = readStove({
    stdt: GINGER_STDT,
    alls: withFields(GINGER_ALLS, { FANLMINMAX: undefined }),
  });
  assert.equal(stove.fans.main.min, 1);
  assert.equal(stove.fans.main.max, 5);
});
