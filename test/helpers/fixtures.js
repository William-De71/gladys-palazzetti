// Real answers of Connection Boxes, from the test fixtures of pypalazzetti
// (anonymized by their authors), trimmed to the fields the integration reads.
// The hydro stove and the alarm are built from them.

/** Ginger: air stove, main fan only (high + auto), Connection Box miniembplug. */
export const GINGER_STDT = {
  GWDEVICE: 'wlan0',
  WMAC: '40:F3:85:71:23:45',
  MAC: '40:F3:85:71:23:45',
  EMAC: '40:F3:85:11:22:33',
  plzbridge: '2.2.1 2021-10-08 09:30:45',
  NOMINALPWR: 9,
  STOVETYPE: 1,
  CHRONOTYPE: 5,
  SPLMIN: 6,
  SPLMAX: 51,
  FAN2MODE: 3,
  FAN2TYPE: 2,
  FLUID: 0,
  PELLETTYPE: 2,
  PSENSTYPE: 0,
  PSENSLTSH: 0,
  UICONFIG: 1,
  MAINTPROBE: 0,
  LABEL: 'Salon',
  CBTYPE: 'miniembplug',
  SN: 'AB012345678901234567890',
  APLCONN: 1,
  SYSTEM: '2.5.3 2021-10-08 10:30:20 (657c8cf)',
};

export const GINGER_ALLS = {
  T2: 25.1,
  F2LF: 1,
  PQT: 1807,
  PWR: 3,
  T4: 0,
  FANLMINMAX: [0, 5, 0, 1, 0, 1],
  FDR: 0,
  F2V: 0,
  MOD: 324,
  DPT: 1632,
  SETP: 21,
  STATUS: 9,
  T3: 45,
  T1: 21.5,
  T5: 0,
  LSTATUS: 51,
  EFLAGS: 1024,
  F2L: 6,
  CHRSTATUS: 0,
};

export const GINGER_CNTR = {
  IGN: 812,
  POWERTIME: '2310:12',
  HEATTIME: '1520:42',
  SERVICETIME: '312:05',
  ONTIME: '3001:00',
  PQT: 1807,
};

/** Julie Pro 2: air stove with three fans (FAN2TYPE 5 → left and right 0-5). */
export const JULIE_STDT = {
  WMAC: '40:F3:85:AA:BB:CC',
  STOVETYPE: 1,
  CHRONOTYPE: 5,
  SPLMIN: 7,
  SPLMAX: 30,
  FAN2MODE: 2,
  FAN2TYPE: 5,
  MAINTPROBE: 4,
  PSENSTYPE: 2,
  LABEL: 'Séjour',
};

export const JULIE_ALLS = {
  T2: 22.4,
  PQT: 1384,
  PWR: 3,
  FANLMINMAX: [0, 5, 0, 5, 0, 5],
  SETP: 20,
  STATUS: 6,
  LSTATUS: 6,
  T3: 220,
  T1: 0,
  T5: 18.4,
  T4: 0,
  F2L: 7,
  F3L: 0,
  F4L: 3,
  PSENSLEMP: 0,
  CHRSTATUS: 1,
};

/** Hydro stove regulating on the return water (UICONFIG 1). */
export const HYDRO_STDT = {
  WMAC: '40:F3:85:00:11:22',
  STOVETYPE: 2,
  UICONFIG: 1,
  MAINTPROBE: 0,
  SPLMIN: 40,
  SPLMAX: 80,
  FAN2TYPE: 1,
  FAN2MODE: 1,
  CHRONOTYPE: 0,
  PSENSTYPE: 1,
  PSENSLTSH: 15,
  LABEL: 'Chaudière',
};

export const HYDRO_ALLS = {
  T1: 62.5,
  T2: 55.1,
  T3: 140,
  T4: 0,
  T5: 0,
  SETP: 60,
  PWR: 4,
  STATUS: 6,
  LSTATUS: 6,
  PQT: 65535,
  PLEVEL: 30,
};

/** Wood stove (STOVETYPE 8): no remote on/off, no power level. */
export const WOOD_STDT = {
  WMAC: '40:F3:85:99:88:77',
  STOVETYPE: 8,
  FAN2TYPE: 1,
  SPLMIN: 7,
  SPLMAX: 30,
};

export const WOOD_ALLS = { T1: 20, T3: 300, SETP: 0, STATUS: 504, LSTATUS: 504 };

/**
 * @description A copy of a fixture with some fields replaced.
 * @param {object} base - The fixture.
 * @param {object} changes - The fields to replace.
 * @returns {object} The copy.
 */
export function withFields(base, changes) {
  return { ...structuredClone(base), ...changes };
}

/**
 * @description The envelope the box wraps every answer in.
 * @param {object} data - DATA.
 * @param {string} [command] - The command.
 * @returns {string} The JSON body.
 */
export function envelope(data, command = 'GET ALLS') {
  return JSON.stringify({
    INFO: { RSP: 'OK', CMD: command, TS: 1728831839 },
    SUCCESS: true,
    DATA: data,
  });
}
