// -----------------------------------------------------------------------------
// What a stove is and does, read from the raw data of its Connection Box.
//
// A snapshot carries the three reads of a box: `stdt` (GET STDT: model,
// probes, fans, bounds — static), `alls` (GET ALLS: status, temperatures,
// setpoint, power, fans — live) and `cntr` (GET CNTR: counters — slow).
// `readStove` turns it into plain values; every capability follows the rules
// of pypalazzetti and of the official Palazzetti SDK, which agree.
// -----------------------------------------------------------------------------

import {
  FAN_AUTO,
  FAN_HIGH,
  HEATING_STATUSES,
  HYDRO_STOVE_TYPES,
  NO_POWER_STOVE_TYPES,
  PHASES,
  SWITCHABLE_STATUSES,
  UNAVAILABLE_VALUE,
  WOOD_STOVE_TYPES,
  alarmCodeOf,
  alarmTypeOf,
  phaseOf,
} from './constants.js';

const PROBES = ['T1', 'T2', 'T3', 'T4', 'T5'];
// Hydro configurations (UICONFIG) where the regulated probe measures water.
const WATER_REGULATED_UICONFIGS = new Set([1, 3, 4]);

const toNumber = (value) => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) ? number : null;
};

const toInteger = (value) => {
  const number = toNumber(value);
  return number === null ? null : Math.round(number);
};

/**
 * @description A temperature, null when the probe is absent (0) or unavailable.
 * @param {unknown} value - The raw value.
 * @returns {number|null} The temperature, one decimal.
 */
function readTemperature(value) {
  const number = toNumber(value);
  if (number === null || number === 0 || number >= UNAVAILABLE_VALUE) {
    return null;
  }
  return Math.round(number * 10) / 10;
}

/**
 * @description Hours of a counter, given as `"hhh:mm"`, as hours + minutes
 * fields (`HEATTIMEH`/`HEATTIMEM`) or as a number.
 * @param {object} cntr - GET CNTR data.
 * @param {string} name - `HEATTIME`, `SERVICETIME`…
 * @returns {number|null} Whole hours.
 * @example
 * readHours({ HEATTIME: '1520:42' }, 'HEATTIME'); // 1520
 */
export function readHours(cntr, name) {
  const raw = cntr?.[name];
  if (typeof raw === 'string') {
    const match = /^\s*(\d+)(?::(\d{1,2}))?\s*$/.exec(raw);
    return match ? Number(match[1]) : null;
  }
  const number = toInteger(raw);
  if (number !== null) {
    return number;
  }
  return toInteger(cntr?.[`${name}H`]);
}

/**
 * @description The probe the stove regulates on (pypalazzetti
 * `_main_temperature_probe_index`).
 * @param {object} stdt - GET STDT data.
 * @returns {{ field: string, water: boolean }} The ALLS field and its nature.
 * @example
 * mainProbe({ STOVETYPE: 1, MAINTPROBE: 0 }); // { field: 'T1', water: false }
 */
export function mainProbe(stdt) {
  const hydro = HYDRO_STOVE_TYPES.has(toInteger(stdt?.STOVETYPE));
  const uiconfig = toInteger(stdt?.UICONFIG);
  if (hydro && uiconfig === 1) {
    return { field: 'T2', water: true };
  }
  if (hydro && uiconfig === 10) {
    return { field: 'T5', water: false };
  }
  const index = toInteger(stdt?.MAINTPROBE);
  const field = PROBES[index >= 0 && index < PROBES.length ? index : 0];
  return { field, water: hydro && WATER_REGULATED_UICONFIGS.has(uiconfig) };
}

/**
 * @description The settings of a fan, null when the stove has none.
 * @param {object} alls - GET ALLS data.
 * @param {string} field - `F2L`, `F3L` or `F4L`.
 * @param {number} rangeIndex - Its index in `FANLMINMAX`.
 * @param {object} [extra] - `{ high, auto }` for the main fan.
 * @returns {{ value: number|null, min: number, max: number, high: boolean, auto: boolean }} The fan.
 */
function readFan(alls, field, rangeIndex, { high = false, auto = false } = {}) {
  const range = Array.isArray(alls?.FANLMINMAX) ? alls.FANLMINMAX : [];
  let min = toInteger(range[rangeIndex]);
  let max = toInteger(range[rangeIndex + 1]);
  if (min === null || max === null || min > max || max > 5) {
    [min, max] = [field === 'F2L' ? 1 : 0, 5];
  }
  return { value: toInteger(alls?.[field]), min, max, high, auto };
}

/**
 * @description The values a fan accepts, in display order.
 * @param {{ min: number, max: number, high: boolean, auto: boolean }} fan - The fan.
 * @returns {number[]} The values (6 = high, 7 = auto).
 * @example
 * fanValues({ min: 1, max: 5, high: true, auto: true }); // [1, 2, 3, 4, 5, 6, 7]
 */
export function fanValues(fan) {
  const values = [];
  for (let value = fan.min; value <= fan.max; value += 1) {
    values.push(value);
  }
  if (fan.high) {
    values.push(FAN_HIGH);
  }
  if (fan.auto) {
    values.push(FAN_AUTO);
  }
  return values;
}

/**
 * @description Read a stove from its snapshot.
 * @param {{ stdt?: object, alls?: object, cntr?: object }} snapshot - The raw data.
 * @returns {object} The stove: identity, capabilities and values.
 * @example
 * const stove = readStove({ stdt, alls, cntr });
 * stove.phase; // 'heating'
 */
export function readStove({ stdt = {}, alls = {}, cntr = {} } = {}) {
  const stoveType = toInteger(stdt.STOVETYPE);
  const fanType = toInteger(stdt.FAN2TYPE) ?? 0;
  const fanMode = toInteger(stdt.FAN2MODE) ?? 0;
  const status = toInteger(alls.LSTATUS ?? alls.STATUS);
  const phase = phaseOf(status);
  const alarmCode = alarmCodeOf(status);
  const hydro = HYDRO_STOVE_TYPES.has(stoveType);
  const wood = WOOD_STOVE_TYPES.has(stoveType);
  const probe = mainProbe(stdt);

  const setpointRaw = toNumber(alls.SETP);
  const pelletsRaw = toInteger(alls.PQT ?? cntr.PQT);
  const pelletSensor = toInteger(stdt.PSENSTYPE) ?? 0;

  const probes = {};
  for (const field of PROBES) {
    probes[field] = readTemperature(alls[field]);
  }

  return {
    name: typeof stdt.LABEL === 'string' && stdt.LABEL.trim() ? stdt.LABEL.trim() : null,
    model: toInteger(alls.MOD ?? stdt.MOD),
    firmware: typeof stdt.SYSTEM === 'string' ? stdt.SYSTEM : null,
    boxType: typeof stdt.CBTYPE === 'string' ? stdt.CBTYPE : null,
    hydro,
    // The box reports whether the stove is wired to it.
    stoveConnected: stdt.APLCONN === undefined ? true : toInteger(stdt.APLCONN) === 1,

    status,
    phase,
    alarm: phase === PHASES.ALARM,
    alarmCode,
    alarmType: alarmCode === null ? null : alarmTypeOf(alarmCode),
    // Burning on purpose: ignition, combustion (periodic clean-fire included) or eco.
    running: phase === PHASES.IGNITION || phase === PHASES.HEATING || phase === PHASES.ECO,
    heating: HEATING_STATUSES.has(status),

    // Wood stoves cannot be switched remotely; the others only from some states.
    hasSwitch: !wood,
    canSwitch: !wood && SWITCHABLE_STATUSES.has(status),

    hasSetpoint: setpointRaw !== null && setpointRaw !== 0,
    setpoint: setpointRaw === null || setpointRaw === 0 ? null : setpointRaw,
    setpointMin: toInteger(stdt.SPLMIN) ?? 7,
    setpointMax: toInteger(stdt.SPLMAX) ?? 30,

    hasPower: !NO_POWER_STOVE_TYPES.has(stoveType),
    power: toInteger(alls.PWR),

    mainProbe: probe,
    // The regulated temperature: the room on an air stove, the water when a
    // hydro stove regulates on its circuit.
    mainTemperature: probes[probe.field],
    probes,

    fans: {
      main:
        fanType > 1
          ? readFan(alls, 'F2L', 0, { high: fanMode === 3, auto: fanMode === 2 || fanMode === 3 })
          : null,
      left: fanType > 3 ? readFan(alls, 'F3L', 2) : null,
      right: fanType > 2 ? readFan(alls, 'F4L', 4) : null,
    },
    hasSilent: fanType > 2,

    hasChrono: (toInteger(stdt.CHRONOTYPE) ?? 0) > 1,
    chrono: toInteger(alls.CHRSTATUS) === 1,

    pelletsConsumed: pelletsRaw === null || pelletsRaw >= UNAVAILABLE_VALUE ? null : pelletsRaw,
    hasPelletLevel: pelletSensor === 1,
    pelletLevel: pelletSensor === 1 ? toNumber(alls.PLEVEL) : null,
    pelletLevelThreshold: toNumber(stdt.PSENSLTSH),
    hasPelletEmpty: pelletSensor === 2,
    pelletEmpty: pelletSensor === 2 ? toInteger(alls.PSENSLEMP) === 1 : null,

    ignitions: toInteger(cntr.IGN),
    heatingHours: readHours(cntr, 'HEATTIME'),
    serviceHours: readHours(cntr, 'SERVICETIME'),
  };
}

/**
 * @description Whether the pellets are low: the capacitive sensor says the
 * hopper is empty, or the Leveltronic level is under its threshold.
 * @param {object} stove - A stove read by readStove.
 * @returns {boolean|null} null when the stove has no pellet sensor.
 * @example
 * pelletsLow(readStove(snapshot));
 */
export function pelletsLow(stove) {
  if (stove.hasPelletEmpty) {
    return stove.pelletEmpty;
  }
  if (stove.hasPelletLevel && stove.pelletLevel !== null && stove.pelletLevelThreshold > 0) {
    return stove.pelletLevel <= stove.pelletLevelThreshold;
  }
  return null;
}
