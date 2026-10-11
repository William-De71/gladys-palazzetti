// -----------------------------------------------------------------------------
// From a value Gladys sends to the command of the Connection Box.
//
// Every command is checked against what the stove accepts before it is sent:
// the box clamps a setpoint silently, and refuses on/off in the middle of an
// ignition or during an alarm with a bare "ERROR". A refusal explained here
// reaches the user (a toast, the scene log) instead.
//
// All the commands are absolute values (never "+1"): sending one twice is
// harmless, which lets the client retry a request the box did not answer.
// -----------------------------------------------------------------------------

import { FAN_AUTO, FAN_HIGH } from './palazzetti/constants.js';
import { fanValues } from './palazzetti/stove.js';
import { FANS, FEATURE_KEYS } from './device.js';
import { all, statusLabel, alarmLabel } from './i18n.js';

export class CommandError extends Error {
  /**
   * @param {string} message - English message (logs, scene errors).
   * @param {object} [translated] - The message in the four languages.
   */
  constructor(message, translated) {
    super(message);
    this.name = 'CommandError';
    this.translated = translated ?? { en: message };
  }
}

/**
 * @description Throw a translated refusal.
 * @param {string} key - The i18n key.
 * @param {object|Function} values - The substitutions (see `all`).
 */
function refuse(key, values) {
  const translated = all(key, values);
  throw new CommandError(translated.en, translated);
}

/**
 * @description The command switching a stove on or off, null when it already
 * is in the requested state.
 * @param {object} stove - The stove (see readStove).
 * @param {boolean} on - true to switch it on.
 * @param {string} name - The stove name, for the refusals.
 * @returns {string|null} `CMD ON`, `CMD OFF` or null.
 * @throws {CommandError} When the stove cannot be switched now.
 * @example
 * switchCommand(stove, true, 'Salon'); // 'CMD ON'
 */
export function switchCommand(stove, on, name) {
  if (!stove.hasSwitch) {
    refuse('refusedNoSwitch', { name });
  }
  if (stove.alarm) {
    refuse('refusedAlarm', (language) => ({
      name,
      alarm: alarmLabel(stove.alarmCode, language),
    }));
  }
  if (stove.running === on) {
    return null;
  }
  if (!stove.canSwitch) {
    refuse('refusedBusy', (language) => ({ name, status: statusLabel(stove.status, language) }));
  }
  return on ? 'CMD ON' : 'CMD OFF';
}

/**
 * @description The command of a setpoint, rounded and bounded.
 * @param {object} stove - The stove.
 * @param {number} value - The requested temperature.
 * @returns {{ command: string, value: number }} The command and the value sent.
 * @throws {CommandError} When the stove has no setpoint or the value is not a number.
 * @example
 * setpointCommand(stove, 21.4); // { command: 'SET SETP 21', value: 21 }
 */
export function setpointCommand(stove, value) {
  const number = Number(value);
  if (!stove.hasSetpoint || !Number.isFinite(number)) {
    throw new CommandError(`Invalid setpoint: ${value}`);
  }
  const bounded = Math.min(stove.setpointMax, Math.max(stove.setpointMin, Math.round(number)));
  return { command: `SET SETP ${bounded}`, value: bounded };
}

/**
 * @description The command of a power level.
 * @param {object} stove - The stove.
 * @param {number|string} value - 1 to 5.
 * @returns {{ command: string, value: number }} The command and the value.
 * @throws {CommandError} Outside 1..5.
 * @example
 * powerCommand(stove, '3'); // { command: 'SET POWR 3', value: 3 }
 */
export function powerCommand(stove, value) {
  const level = Number(value);
  if (!stove.hasPower || !Number.isInteger(level) || level < 1 || level > 5) {
    throw new CommandError(`Invalid power level: ${value}`);
  }
  return { command: `SET POWR ${level}`, value: level };
}

/**
 * @description Read a fan value: a number, or `high` / `auto` / `off`.
 * @param {unknown} value - The value.
 * @returns {number|null} 0-7, null when not a fan value.
 * @example
 * readFanValue('auto'); // 7
 */
export function readFanValue(value) {
  const named = { off: 0, high: FAN_HIGH, auto: FAN_AUTO };
  if (typeof value === 'string' && value.trim().toLowerCase() in named) {
    return named[value.trim().toLowerCase()];
  }
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

/**
 * @description The command of a fan.
 * @param {object} stove - The stove.
 * @param {string} key - The feature key (`fan-main`, `fan-left`, `fan-right`).
 * @param {unknown} value - The value (see readFanValue).
 * @returns {{ command: string, value: number }} The command and the value.
 * @throws {CommandError} When the fan does not exist or refuses the value.
 * @example
 * fanCommand(stove, 'fan-main', 7); // { command: 'SET RFAN 7', value: 7 }
 */
export function fanCommand(stove, key, value) {
  const fan = FANS[key];
  const settings = fan ? stove.fans[fan.name] : null;
  const level = readFanValue(value);
  if (!settings || level === null || !fanValues(settings).includes(level)) {
    throw new CommandError(`Invalid value for ${key}: ${value}`);
  }
  return { command: `${fan.command} ${level}`, value: level };
}

/**
 * @description The commands of a feature value sent by Gladys.
 * @param {object} stove - The stove.
 * @param {string} key - The feature key.
 * @param {number|string} value - The value.
 * @param {string} name - The stove name, for the refusals.
 * @returns {string[]} The commands to send, in order (empty: nothing to do).
 * @throws {CommandError} When the value cannot be applied.
 * @example
 * featureCommands(stove, 'mode', 1, 'Salon'); // ['CMD ON']
 */
export function featureCommands(stove, key, value, name) {
  switch (key) {
    case FEATURE_KEYS.MODE: {
      const command = switchCommand(stove, Number(value) > 0, name);
      return command ? [command] : [];
    }
    case FEATURE_KEYS.SETPOINT:
      return [setpointCommand(stove, value).command];
    case FEATURE_KEYS.POWER:
      return [powerCommand(stove, value).command];
    case FEATURE_KEYS.FAN_MAIN:
    case FEATURE_KEYS.FAN_LEFT:
    case FEATURE_KEYS.FAN_RIGHT:
      return [fanCommand(stove, key, value).command];
    case FEATURE_KEYS.SILENT:
      if (!stove.hasSilent) {
        throw new CommandError('This stove has no silent mode');
      }
      return ['SET SLNT 1'];
    case FEATURE_KEYS.CHRONO:
      if (!stove.hasChrono) {
        throw new CommandError('This stove has no weekly schedule');
      }
      return [`SET CSST ${Number(value) > 0 ? 1 : 0}`];
    default:
      throw new CommandError(`The feature "${key}" is read-only`);
  }
}

/**
 * @description The command setting the clock of the stove.
 * @param {Date} date - The time, read in the time zone of the container (the
 * Gladys supervisor passes TZ).
 * @returns {string} `SET TIME 2026-10-12 08:30:00`.
 * @example
 * clockCommand(new Date());
 */
export function clockCommand(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `SET TIME ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
