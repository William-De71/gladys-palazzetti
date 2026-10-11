// -----------------------------------------------------------------------------
// Scene actions of the integration.
//
//   - `get_status`  a fresh read of a stove, as scalar outputs for the
//                   following actions (conditions, messages);
//   - `control`     on / off, setpoint, power level and fan in one action;
//                   every empty field is left as it is. The settings go first
//                   and the on/off last, so a stove switched on starts with
//                   the requested setpoint.
// Both target a stove through a `source: "devices"` select; empty = the first
// stove.
// -----------------------------------------------------------------------------

import {
  fanCommand,
  powerCommand,
  readFanValue,
  setpointCommand,
  switchCommand,
} from './commands.js';
import { FEATURE_KEYS } from './device.js';
import { describeStove } from './events.js';
import { alarmLabel, fanLabel, t, statusLabel } from './i18n.js';

// Keys of the manifest `scene_actions`: never rename one.
export const SCENE_ACTIONS = { GET_STATUS: 'get_status', CONTROL: 'control' };

export const SWITCH_VALUES = { UNCHANGED: 'unchanged', ON: 'on', OFF: 'off' };

/**
 * @description Outputs of `get_status`.
 * @param {string} name - The stove name.
 * @param {object} stove - The stove (see readStove).
 * @param {string} language - Language of the labels and summary.
 * @returns {object} The outputs.
 * @example
 * buildStatusOutputs('Salon', stove, 'fr');
 */
export function buildStatusOutputs(name, stove, language) {
  return {
    stove_name: name,
    on: stove.running,
    heating: stove.heating,
    phase: stove.phase,
    status_label: statusLabel(stove.status, language),
    alarm: stove.alarm,
    alarm_label: stove.alarm ? alarmLabel(stove.alarmCode, language) : '',
    temperature: stove.mainTemperature,
    setpoint: stove.setpoint,
    power_level: stove.hasPower ? stove.power : null,
    fan:
      stove.fans.main && Number.isInteger(stove.fans.main.value)
        ? fanLabel(stove.fans.main.value, language)
        : '',
    flue_gas_temperature: stove.probes.T3,
    pellets_consumed: stove.pelletsConsumed,
    summary: describeStove(name, stove, language),
  };
}

/**
 * @description Plan the commands of a `control` action.
 * @param {object} stove - The stove (see readStove).
 * @param {object} fields - The resolved fields `{ power, setpoint, power_level, fan }`.
 * @param {string} name - The stove name, for the refusals.
 * @returns {{ commands: string[], changes: Function }} The commands in order,
 * and `(language) => string[]` describing them.
 * @throws {CommandError} When a value cannot be applied.
 * @example
 * planControl(stove, { power: 'on', setpoint: 21 }, 'Salon').commands; // ['SET SETP 21', 'CMD ON']
 */
export function planControl(stove, fields, name) {
  const commands = [];
  const changes = [];
  const filled = (value) => value !== undefined && value !== null && String(value).trim() !== '';

  if (filled(fields.setpoint)) {
    const { command, value } = setpointCommand(stove, fields.setpoint);
    if (value !== stove.setpoint) {
      commands.push(command);
      changes.push((language) => t('changeSetpoint', language, { value }));
    }
  }
  if (filled(fields.power_level)) {
    const { command, value } = powerCommand(stove, fields.power_level);
    if (value !== stove.power) {
      commands.push(command);
      changes.push((language) => t('changePower', language, { value }));
    }
  }
  if (filled(fields.fan)) {
    const { command, value } = fanCommand(stove, FEATURE_KEYS.FAN_MAIN, readFanValue(fields.fan));
    if (value !== stove.fans.main?.value) {
      commands.push(command);
      changes.push((language) => t('changeFan', language, { value: fanLabel(value, language) }));
    }
  }
  if (fields.power === SWITCH_VALUES.ON || fields.power === SWITCH_VALUES.OFF) {
    const on = fields.power === SWITCH_VALUES.ON;
    const command = switchCommand(stove, on, name);
    if (command) {
      commands.push(command);
      changes.push((language) => t(on ? 'changeOn' : 'changeOff', language));
    }
  }
  return { commands, changes: (language) => changes.map((change) => change(language)) };
}

/**
 * @description Outputs of `control`.
 * @param {string} name - The stove name.
 * @param {string[]} changes - What was sent, in words.
 * @param {object} stove - The stove after the commands.
 * @param {string} language - The language.
 * @returns {object} The outputs `{ changed, summary, phase }`.
 * @example
 * buildControlOutputs('Salon', ['consigne 21 °C'], stove, 'fr');
 */
export function buildControlOutputs(name, changes, stove, language) {
  return {
    changed: changes.length > 0,
    phase: stove.phase,
    summary:
      changes.length > 0
        ? t('summaryControl', language, { name, changes: changes.join(', ') })
        : t('summaryNothing', language, { name }),
  };
}
