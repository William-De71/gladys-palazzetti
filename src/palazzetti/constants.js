// -----------------------------------------------------------------------------
// Constants of the Palazzetti Connection Box local API.
//
// The box answers plain HTTP on port 80: `GET /cgi-bin/sendmsg.lua?cmd=...`,
// one command at a time (it relays them to the stove over a slow serial link),
// with a JSON envelope `{ INFO: { RSP, CMD }, SUCCESS, DATA }`. It also answers
// the UDP probe `plzbridge?` on port 54549 with its static data (GET STDT).
//
// The tables below come from the field reverse-engineering shared by
// pypalazzetti (the library of the Home Assistant integration), the official
// Palazzetti asset parser SDK and the WPalaControl emulator, which mirror the
// Connection Box firmware.
// -----------------------------------------------------------------------------

export const HTTP_PATH = '/cgi-bin/sendmsg.lua';
export const DISCOVERY_PORT = 54549;
export const DISCOVERY_PROBE = 'plzbridge?';

// The serial link is slow and a busy box takes several seconds to answer.
export const REQUEST_TIMEOUT_MS = 12000;

// A value the box reports when the stove does not provide it.
export const UNAVAILABLE_VALUE = 65535;

// Phases: what the stove is doing, grouped from the detailed status codes.
// They are the values of the scene trigger filters: never rename one.
export const PHASES = {
  OFF: 'off',
  IGNITION: 'ignition',
  HEATING: 'heating',
  ECO: 'eco',
  COOLING: 'cooling',
  CLEANING: 'cleaning',
  ALARM: 'alarm',
  UNKNOWN: 'unknown',
};

// Families of alarms, values of the "alarm type" filter: never rename one.
export const ALARM_TYPES = {
  PELLET: 'pellet',
  DOOR: 'door',
  OVERHEAT: 'overheat',
  FLUE: 'flue',
  PROBE: 'probe',
  FUEL: 'fuel',
  CLEANING: 'cleaning',
  OTHER: 'other',
};

// LSTATUS (the "logical" status computed by the box: alarms in 1xxx, eco mode
// in 51, wood mode of the multifire stoves in 50x) -> phase.
const PHASE_BY_STATUS = {
  0: PHASES.OFF,
  1: PHASES.OFF, // off, chrono timer armed
  2: PHASES.IGNITION, // test fire
  3: PHASES.IGNITION, // heat-up
  4: PHASES.IGNITION, // fueling
  5: PHASES.IGNITION, // ignition test
  6: PHASES.HEATING, // burning
  7: PHASES.HEATING, // burning, modulating
  9: PHASES.COOLING, // cool fluid (hydro)
  10: PHASES.COOLING, // fire stop
  // Periodic brazier cleaning while burning: still heating (a phase change
  // every few hours would only be noise for the scenes).
  11: PHASES.HEATING, // clean fire
  12: PHASES.COOLING, // cooling
  50: PHASES.CLEANING, // final cleanup
  51: PHASES.ECO, // eco mode: waiting for the room to cool down
  501: PHASES.OFF, // multifire (wood): off
  502: PHASES.IGNITION, // multifire: fueling
  503: PHASES.IGNITION, // multifire: ignition test
  504: PHASES.HEATING, // multifire: burning
  505: PHASES.OFF, // multifire: firewood finished
  506: PHASES.COOLING, // multifire: cooling
  507: PHASES.CLEANING, // multifire: clean fire
};

// Alarm code (the raw 2xx code; LSTATUS carries it + 1000) -> family.
const ALARM_TYPE_BY_CODE = {
  239: ALARM_TYPES.DOOR, // door open (multifire)
  240: ALARM_TYPES.OVERHEAT, // temperature too high
  241: ALARM_TYPES.CLEANING, // chimney alarm: the flue needs cleaning
  243: ALARM_TYPES.FUEL, // grate / fuel error
  244: ALARM_TYPES.PROBE, // NTC2 (pellet / water probe)
  245: ALARM_TYPES.PROBE, // NTC3
  247: ALARM_TYPES.DOOR, // hatch door open
  248: ALARM_TYPES.FLUE, // pressure (depression) alarm
  249: ALARM_TYPES.PROBE, // NTC1, main probe failure
  250: ALARM_TYPES.PROBE, // TC1, flue gas probe failure
  252: ALARM_TYPES.OVERHEAT, // exhaust (flue gas) temperature too high
  253: ALARM_TYPES.PELLET, // no pellet
};

// Statuses from which the box accepts CMD ON / CMD OFF (pypalazzetti
// `has_on_off_switch`, identical to the official SDK): never in the middle of
// an ignition, a fire stop or an alarm.
export const SWITCHABLE_STATUSES = new Set([0, 1, 6, 7, 9, 11, 12, 51, 501, 504, 505, 506, 507]);

// Statuses during which the stove is actually producing heat.
export const HEATING_STATUSES = new Set([2, 3, 4, 5, 6, 7, 502, 503, 504]);

// Stove types (GET STDT `STOVETYPE`).
export const HYDRO_STOVE_TYPES = new Set([2, 4, 6]);
export const WOOD_STOVE_TYPES = new Set([7, 8]); // no remote on/off
export const NO_POWER_STOVE_TYPES = new Set([8]);

// Main room fan (`F2L` / `SET RFAN`): 0-5 are speeds (0 = off), 6 = high,
// 7 = auto. The other fans (`F3L`, `F4L`) only take 0-5.
export const FAN_HIGH = 6;
export const FAN_AUTO = 7;

/**
 * @description The phase of a logical status.
 * @param {number} status - LSTATUS.
 * @returns {string} One of PHASES.
 * @example
 * phaseOf(6); // 'heating'
 */
export function phaseOf(status) {
  if (!Number.isInteger(status)) {
    return PHASES.UNKNOWN;
  }
  if (status >= 1000) {
    return PHASES.ALARM;
  }
  if (status > 200 && status < 300) {
    // A raw alarm code (a box that does not compute LSTATUS).
    return PHASES.ALARM;
  }
  return PHASE_BY_STATUS[status] ?? PHASES.UNKNOWN;
}

/**
 * @description The raw alarm code of a logical status, null outside alarms.
 * @param {number} status - LSTATUS.
 * @returns {number|null} The 2xx code (or the 1xxx code with no 2xx twin).
 * @example
 * alarmCodeOf(1253); // 253
 */
export function alarmCodeOf(status) {
  if (phaseOf(status) !== PHASES.ALARM) {
    return null;
  }
  return status >= 1200 && status < 1300 ? status - 1000 : status;
}

/**
 * @description The family of an alarm.
 * @param {number|null} code - The alarm code (see alarmCodeOf).
 * @returns {string} One of ALARM_TYPES.
 * @example
 * alarmTypeOf(253); // 'pellet'
 */
export function alarmTypeOf(code) {
  return ALARM_TYPE_BY_CODE[code] ?? ALARM_TYPES.OTHER;
}
