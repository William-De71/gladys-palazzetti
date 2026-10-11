// -----------------------------------------------------------------------------
// The Gladys device of a stove.
//
// One device per Connection Box, offered on the Discovery screen. Its features
// follow what the stove can do (see palazzetti/stove.js):
//   - `mode`          thermostat/mode: off / heating — the on/off switch;
//   - `setpoint`      thermostat/target-temperature, within SPLMIN..SPLMAX;
//   - `operating`     thermostat/operating-state: actually producing heat;
//   - `room`          the regulated temperature (room, or water on a hydro);
//   - `probe-tN`      the other probes: flue gas, water flow/return, air outlet;
//   - `status`        text: the detailed status, or the alarm in words;
//   - `alarm`         binary: 1 while the stove is in alarm (`unknown/binary`:
//                     the only generic binary the Gladys front labels);
//   - `power`         text/select 1..5: Gladys has no "heat level" type, and
//                     an enum standards cover would mislabel it;
//   - `fan-main`, `fan-left`, `fan-right`  text/select: off, 1..5, high, auto
//                     (FAN_MODE has three speeds only);
//   - `silent`        button: silent mode (every fan off);
//   - `chrono`        switch: the weekly schedule of the stove;
//   - `pellets`, `pellet-level`, `pellet-empty`, counters.
//
// The feature external ids end with these keys: commands and states are
// matched on them, so they are never renamed.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { fanValues } from './palazzetti/stove.js';
import { t, fanLabel, stateLabel } from './i18n.js';

export const DEVICE_TYPE = 'stove';
export const PARAMS = { IP_ADDRESS: 'IP_ADDRESS', STOVE_ID: 'PALAZZETTI_ID' };

export const FEATURE_KEYS = {
  MODE: 'mode',
  SETPOINT: 'setpoint',
  OPERATING: 'operating',
  ROOM: 'room',
  STATUS: 'status',
  ALARM: 'alarm',
  POWER: 'power',
  FAN_MAIN: 'fan-main',
  FAN_LEFT: 'fan-left',
  FAN_RIGHT: 'fan-right',
  SILENT: 'silent',
  CHRONO: 'chrono',
  PELLETS: 'pellets',
  PELLET_LEVEL: 'pellet-level',
  PELLET_EMPTY: 'pellet-empty',
  IGNITIONS: 'ignitions',
  HEATING_HOURS: 'heating-hours',
  SERVICE_HOURS: 'service-hours',
};

// Fans by feature key: the stove field and the box command.
export const FANS = {
  [FEATURE_KEYS.FAN_MAIN]: { name: 'main', label: 'featureFanMain', command: 'SET RFAN' },
  [FEATURE_KEYS.FAN_LEFT]: { name: 'left', label: 'featureFanLeft', command: 'SET FN3L' },
  [FEATURE_KEYS.FAN_RIGHT]: { name: 'right', label: 'featureFanRight', command: 'SET FN4L' },
};

const THERMOSTAT_MODE = { OFF: 0, HEATING: 1 };
const OPERATING_STATE = { IDLE: 0, HEATING: 1 };
const MAX_PELLETS_KG = 10000000;
const MAX_COUNTER = 1000000;

/**
 * @description The external ids of a stove.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} id - The stove id (see stoveId).
 * @returns {{ device: string, feature: Function }} The ids.
 * @example
 * idsOf(gladys, '40f385712345').feature('setpoint');
 */
export function idsOf(gladys, id) {
  return gladys.externalIds(DEVICE_TYPE, id);
}

/**
 * @description The stove id and the feature key of an external id.
 * @param {string} externalId - A device or feature external id.
 * @returns {{ id: string, key: string|null }|null} null when not a stove id.
 * @example
 * parseExternalId('ext:palazzetti:stove:40f385712345:setpoint'); // { id: '40f385712345', key: 'setpoint' }
 */
export function parseExternalId(externalId) {
  const match = new RegExp(`:${DEVICE_TYPE}:([a-z0-9]+)(?::([a-z0-9-]+))?$`).exec(
    String(externalId ?? ''),
  );
  return match ? { id: match[1], key: match[2] ?? null } : null;
}

/**
 * @description The temperature probes besides the regulated one.
 * @param {object} stove - A stove read by readStove.
 * @returns {Array<{ field: string, label: string }>} The probes to expose.
 * @example
 * extraProbes(stove); // [{ field: 'T3', label: 'featureExhaust' }]
 */
export function extraProbes(stove) {
  const probes = [];
  const add = (field, label) => {
    if (field !== stove.mainProbe.field && stove.probes[field] !== null) {
      probes.push({ field, label });
    }
  };
  if (stove.hydro) {
    add('T1', 'featureWaterOut');
    add('T2', 'featureWaterReturn');
  }
  add('T3', 'featureExhaust');
  add('T4', 'featureAirOutlet');
  return probes;
}

const sensor = (feature) => ({
  read_only: true,
  has_feedback: false,
  keep_history: true,
  ...feature,
});

const command = (feature) => ({
  read_only: false,
  has_feedback: true,
  keep_history: true,
  ...feature,
});

const temperature = (feature) => sensor({ unit: UNITS.CELSIUS, min: -20, max: 1000, ...feature });

/**
 * @description The options of a fan select.
 * @param {object} fan - The fan (see readStove).
 * @param {string} language - Language of the labels.
 * @returns {Array<{ value: string, label: string }>} The options.
 */
function fanOptions(fan, language) {
  return fanValues(fan).map((value) => ({
    value: String(value),
    label: fanLabel(value, language),
  }));
}

/**
 * @description Build the device of a stove.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} options - Options.
 * @param {string} options.id - The stove id.
 * @param {string} options.host - The address of its Connection Box.
 * @param {object} options.stove - The stove (see readStove).
 * @param {string} [options.language] - Language of the names.
 * @returns {object} The discovered device.
 * @example
 * await gladys.publishDiscoveredDevices([buildDevice(gladys, { id, host, stove, language: 'fr' })]);
 */
export function buildDevice(gladys, { id, host, stove, language = 'en' }) {
  const ids = idsOf(gladys, id);
  const feature = (key) => ids.feature(key);
  const features = [];

  if (stove.hasSwitch) {
    features.push(
      command({
        name: t('featureMode', language),
        external_id: feature(FEATURE_KEYS.MODE),
        category: CATEGORIES.THERMOSTAT,
        type: TYPES.THERMOSTAT.MODE,
        min: THERMOSTAT_MODE.OFF,
        max: THERMOSTAT_MODE.HEATING,
        supported_options: [
          { value: THERMOSTAT_MODE.OFF, label: t('phase_off', language) },
          { value: THERMOSTAT_MODE.HEATING, label: t('featureOperating', language) },
        ],
      }),
    );
  }
  if (stove.hasSetpoint) {
    features.push(
      command({
        name: t('featureSetpoint', language),
        external_id: feature(FEATURE_KEYS.SETPOINT),
        category: CATEGORIES.THERMOSTAT,
        type: TYPES.THERMOSTAT.TARGET_TEMPERATURE,
        unit: UNITS.CELSIUS,
        min: stove.setpointMin,
        max: Math.max(stove.setpointMin + 1, stove.setpointMax),
        step: 1,
      }),
    );
  }
  features.push(
    sensor({
      name: t('featureOperating', language),
      external_id: feature(FEATURE_KEYS.OPERATING),
      category: CATEGORIES.THERMOSTAT,
      type: TYPES.THERMOSTAT.OPERATING_STATE,
      min: OPERATING_STATE.IDLE,
      max: OPERATING_STATE.HEATING,
    }),
  );
  if (stove.mainTemperature !== null) {
    features.push(
      temperature({
        name: t(stove.mainProbe.water ? 'featureWaterRegulated' : 'featureRoom', language),
        external_id: feature(FEATURE_KEYS.ROOM),
        category: CATEGORIES.TEMPERATURE_SENSOR,
        type: stove.mainProbe.water ? TYPES.TEMPERATURE_SENSOR.PROBE : TYPES.SENSOR.DECIMAL,
        min: -20,
        max: 100,
      }),
    );
  }
  for (const probe of extraProbes(stove)) {
    features.push(
      temperature({
        name: t(probe.label, language),
        external_id: feature(`probe-${probe.field.toLowerCase()}`),
        category: CATEGORIES.TEMPERATURE_SENSOR,
        type: TYPES.TEMPERATURE_SENSOR.PROBE,
      }),
    );
  }
  features.push(
    sensor({
      name: t('featureStatus', language),
      external_id: feature(FEATURE_KEYS.STATUS),
      category: CATEGORIES.TEXT,
      type: TYPES.TEXT.TEXT,
      keep_history: false,
      min: 0,
      max: 0,
    }),
    sensor({
      name: t('featureAlarm', language),
      external_id: feature(FEATURE_KEYS.ALARM),
      category: CATEGORIES.UNKNOWN,
      type: TYPES.SENSOR.BINARY,
      min: 0,
      max: 1,
    }),
  );
  if (stove.hasPower) {
    features.push(
      command({
        name: t('featurePower', language),
        external_id: feature(FEATURE_KEYS.POWER),
        category: CATEGORIES.TEXT,
        type: TYPES.TEXT.SELECT,
        keep_history: false,
        min: 0,
        max: 0,
        supported_options: [1, 2, 3, 4, 5].map((n) => ({
          value: String(n),
          label: t('powerLevel', language, { n }),
        })),
      }),
    );
  }
  for (const [key, fan] of Object.entries(FANS)) {
    if (stove.fans[fan.name]) {
      features.push(
        command({
          name: t(fan.label, language),
          external_id: feature(key),
          category: CATEGORIES.TEXT,
          type: TYPES.TEXT.SELECT,
          keep_history: false,
          min: 0,
          max: 0,
          supported_options: fanOptions(stove.fans[fan.name], language),
        }),
      );
    }
  }
  if (stove.hasSilent) {
    features.push(
      command({
        name: t('featureSilent', language),
        external_id: feature(FEATURE_KEYS.SILENT),
        category: CATEGORIES.BUTTON,
        type: TYPES.BUTTON.PUSH,
        has_feedback: false,
        keep_history: false,
        min: 0,
        max: 1,
      }),
    );
  }
  if (stove.hasChrono) {
    features.push(
      command({
        name: t('featureChrono', language),
        external_id: feature(FEATURE_KEYS.CHRONO),
        category: CATEGORIES.SWITCH,
        type: TYPES.SWITCH.BINARY,
        min: 0,
        max: 1,
      }),
    );
  }
  if (stove.pelletsConsumed !== null) {
    features.push(
      // Gladys has no kg unit: the name carries it.
      sensor({
        name: t('featurePellets', language),
        external_id: feature(FEATURE_KEYS.PELLETS),
        category: CATEGORIES.COUNTER_SENSOR,
        type: TYPES.SENSOR.INTEGER,
        min: 0,
        max: MAX_PELLETS_KG,
      }),
    );
  }
  if (stove.hasPelletLevel) {
    features.push(
      sensor({
        name: t('featurePelletLevel', language),
        external_id: feature(FEATURE_KEYS.PELLET_LEVEL),
        category: CATEGORIES.LEVEL_SENSOR,
        type: TYPES.LEVEL_SENSOR.LIQUID_DEPTH,
        unit: UNITS.CM,
        min: 0,
        max: 200,
      }),
    );
  }
  if (stove.hasPelletEmpty) {
    features.push(
      sensor({
        name: t('featurePelletEmpty', language),
        external_id: feature(FEATURE_KEYS.PELLET_EMPTY),
        category: CATEGORIES.UNKNOWN,
        type: TYPES.SENSOR.BINARY,
        min: 0,
        max: 1,
      }),
    );
  }
  if (stove.ignitions !== null) {
    features.push(
      sensor({
        name: t('featureIgnitions', language),
        external_id: feature(FEATURE_KEYS.IGNITIONS),
        category: CATEGORIES.COUNTER_SENSOR,
        type: TYPES.SENSOR.INTEGER,
        min: 0,
        max: MAX_COUNTER,
      }),
    );
  }
  for (const [key, field, label] of [
    [FEATURE_KEYS.HEATING_HOURS, 'heatingHours', 'featureHeatingHours'],
    [FEATURE_KEYS.SERVICE_HOURS, 'serviceHours', 'featureServiceHours'],
  ]) {
    if (stove[field] !== null) {
      features.push(
        sensor({
          name: t(label, language),
          external_id: feature(key),
          category: CATEGORIES.DURATION,
          type: TYPES.DURATION.INTEGER,
          unit: UNITS.HOURS,
          min: 0,
          max: MAX_COUNTER,
        }),
      );
    }
  }

  return {
    name: stove.name ?? t('defaultName', language),
    external_id: ids.device,
    should_poll: false,
    params: [
      { name: PARAMS.IP_ADDRESS, value: host },
      { name: PARAMS.STOVE_ID, value: id },
    ],
    features,
  };
}

/**
 * @description The states of a stove, for the features its device declares.
 * An unknown value is left out, never published as 0 (a 0 would look like a
 * reset in the history and fire the "lower than" scenes).
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} id - The stove id.
 * @param {object} stove - The stove (see readStove).
 * @param {string} language - Language of the status text.
 * @returns {Array<object>} The states.
 * @example
 * await gladys.publishStates(buildStates(gladys, id, stove, 'fr'));
 */
export function buildStates(gladys, id, stove, language) {
  const ids = idsOf(gladys, id);
  const states = [];
  const number = (key, value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      states.push({ device_feature_external_id: ids.feature(key), state: value });
    }
  };
  const text = (key, value) => {
    if (typeof value === 'string' && value !== '') {
      states.push({ device_feature_external_id: ids.feature(key), text: value });
    }
  };

  if (stove.hasSwitch && stove.status !== null) {
    number(FEATURE_KEYS.MODE, stove.running ? THERMOSTAT_MODE.HEATING : THERMOSTAT_MODE.OFF);
  }
  number(FEATURE_KEYS.SETPOINT, stove.setpoint);
  if (stove.status !== null) {
    number(FEATURE_KEYS.OPERATING, stove.heating ? OPERATING_STATE.HEATING : OPERATING_STATE.IDLE);
    text(FEATURE_KEYS.STATUS, stateLabel(stove, language));
    number(FEATURE_KEYS.ALARM, stove.alarm ? 1 : 0);
  }
  number(FEATURE_KEYS.ROOM, stove.mainTemperature);
  for (const probe of extraProbes(stove)) {
    number(`probe-${probe.field.toLowerCase()}`, stove.probes[probe.field]);
  }
  if (stove.hasPower && stove.power >= 1 && stove.power <= 5) {
    text(FEATURE_KEYS.POWER, String(stove.power));
  }
  for (const [key, fan] of Object.entries(FANS)) {
    const value = stove.fans[fan.name]?.value;
    if (Number.isInteger(value)) {
      text(key, String(value));
    }
  }
  if (stove.hasChrono) {
    number(FEATURE_KEYS.CHRONO, stove.chrono ? 1 : 0);
  }
  number(FEATURE_KEYS.PELLETS, stove.pelletsConsumed);
  if (stove.hasPelletLevel) {
    number(FEATURE_KEYS.PELLET_LEVEL, stove.pelletLevel);
  }
  if (stove.hasPelletEmpty && stove.pelletEmpty !== null) {
    number(FEATURE_KEYS.PELLET_EMPTY, stove.pelletEmpty ? 1 : 0);
  }
  number(FEATURE_KEYS.IGNITIONS, stove.ignitions);
  number(FEATURE_KEYS.HEATING_HOURS, stove.heatingHours);
  number(FEATURE_KEYS.SERVICE_HOURS, stove.serviceHours);
  return states;
}
