// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh, TZ=Europe/Paris)
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildStoveWidget, buildConsumptionWidget } = await load('src/widgets.js');
const { readStove } = await load('src/palazzetti/stove.js');
const { buildDevice, idsOf, FEATURE_KEYS } = await load('src/device.js');
const { record, dailyBurn } = await load('src/history.js');
const { LANGUAGES } = await load('src/i18n.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

// A winter evening: Tuesday 19 January 2027, 18:30, the stove burning since
// its evening program started at 16:30.
const NOW = new Date('2027-01-19T18:30:00');
const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const at = (daysAgo, hours, minutes = 0) => {
  const date = new Date(NOW);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

// Seeded, so the illustrations are reproducible.
let seed = 11;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

// The three reads of the Connection Box (GET STDT, GET ALLS, GET CNTR), shaped
// like the real answers of a Ginger (air stove, room fan with high and auto,
// weekly schedule) with a capacitive pellet sensor.
const STDT = {
  MAC: '40:F3:85:71:23:45',
  LABEL: 'Salon',
  STOVETYPE: 1,
  CHRONOTYPE: 5,
  SPLMIN: 6,
  SPLMAX: 51,
  FAN2MODE: 3,
  FAN2TYPE: 2,
  PSENSTYPE: 2,
  UICONFIG: 1,
  MAINTPROBE: 0,
  CBTYPE: 'miniembplug',
  APLCONN: 1,
};
const PELLETS_NOW = 1934;
const ALLS = {
  LSTATUS: 6,
  STATUS: 6,
  T1: 21.4,
  T2: 0,
  T3: 131,
  T4: 0,
  T5: 0,
  SETP: 21,
  PWR: 3,
  F2L: 7,
  FANLMINMAX: [0, 5, 0, 1, 0, 1],
  CHRSTATUS: 1,
  PSENSLEMP: 0,
  PQT: PELLETS_NOW,
};
const CNTR = { IGN: 846, HEATTIME: '1587:20', SERVICETIME: '379:45', PQT: PELLETS_NOW };
const stove = readStove({ stdt: STDT, alls: ALLS, cntr: CNTR });
const id = '40f385712345';
const gladys = {
  externalIds: (type, platformId) => {
    const device = `ext:palazzetti:${type}:${platformId}`;
    return { device, feature: (key) => `${device}:${key}` };
  },
};
const feature = idsOf(gladys, id).feature;
const ROOM = feature(FEATURE_KEYS.ROOM);
const SETPOINT = feature(FEATURE_KEYS.SETPOINT);

// --- The pellet counter, day after day ---------------------------------------
// About 8 kg on a January day, more on the cold ones; today is still running.
// The integration records the counter at every read (history.js).
const history = { days: {} };
let counter = PELLETS_NOW;
const burnt = [];
for (let daysAgo = 0; daysAgo <= 15; daysAgo += 1) {
  const kg = daysAgo === 0 ? 4 : Math.round(6 + random() * 5 + (daysAgo % 7 < 2 ? 1 : 0));
  burnt.unshift(kg);
}
counter -= burnt.reduce((sum, kg) => sum + kg, 0);
burnt.forEach((kg, index) => {
  const daysAgo = burnt.length - 1 - index;
  record(history, counter, at(daysAgo, 0, 5));
  // Morning program, then the evening one.
  record(history, counter + Math.round(kg * 0.35), at(daysAgo, 9));
  counter += kg;
  record(history, counter, daysAgo === 0 ? NOW : at(daysAgo, 23, 55));
});
const daily = dailyBurn(history, NOW, 14);

// --- The last 24 hours of the room probe and the setpoint ---------------------
// The weekly schedule of the stove: 06:00-08:30 at 20 °C, 16:30-22:00 at
// 21 °C, the stove off in between. Yesterday evening the setpoint was raised
// to 22 °C from the widget for an hour and a half.
const SETPOINT_CHANGES = [
  [at(1, 19, 5), 22],
  [at(1, 20, 40), 21],
  [at(0, 6), 20],
  [at(0, 16, 30), 21],
];
const setpointAt = (time) => {
  let value = 21;
  for (const [when, next] of SETPOINT_CHANGES) {
    if (time >= when) value = next;
  }
  return value;
};
const heatingAt = (time) => {
  const minutes = time.getHours() * 60 + time.getMinutes();
  return (minutes >= 360 && minutes < 510) || (minutes >= 990 && minutes < 1320);
};
// Read every 30 s, published when the value (0.1 °C) changes, like the
// integration does; Gladys then averages them into 100 buckets
// (getDeviceFeaturesAggregates: NTILE(100)).
const roomStates = [];
let temperature = 21.1;
let last = null;
for (let time = NOW.getTime() - 24 * HOUR; time <= NOW.getTime(); time += 30000) {
  const date = new Date(time);
  const target = heatingAt(date) ? setpointAt(date) + 0.3 : 16.2;
  const sun = date.getHours() >= 11 && date.getHours() < 15 ? 0.00004 : 0;
  temperature += (target - temperature) * (heatingAt(date) ? 0.012 : 0.0012) + sun * 30;
  temperature += (random() - 0.5) * 0.01;
  const value = Math.round(temperature * 10) / 10;
  if (value !== last) {
    roomStates.push({ t: time, v: value });
    last = value;
  }
}
roomStates.push({ t: NOW.getTime(), v: stove.mainTemperature });
// The setpoint is published on change and again every 10 minutes
// (SETPOINT_REPEAT_MS in src/app.js), which keeps its line flat.
const setpointStates = [];
let lastSetpoint = null;
for (let time = NOW.getTime() - 24 * HOUR; time <= NOW.getTime(); time += 30000) {
  const value = setpointAt(new Date(time));
  if (value !== lastSetpoint?.v || time - lastSetpoint.t >= 10 * 60 * 1000) {
    lastSetpoint = { t: time, v: value };
    setpointStates.push(lastSetpoint);
  }
}
const aggregate = (states, buckets = 100) => {
  if (states.length <= buckets) return states;
  const result = [];
  for (let index = 0; index < buckets; index += 1) {
    const slice = states.slice(
      Math.floor((index * states.length) / buckets),
      Math.floor(((index + 1) * states.length) / buckets),
    );
    result.push({ t: slice[0].t, v: slice.reduce((sum, s) => sum + s.v, 0) / slice.length });
  }
  return result;
};
const HISTORY = {
  [ROOM]: aggregate(roomStates),
  [SETPOINT]: aggregate(setpointStates),
};

// --- The contents, in the four languages --------------------------------------
const widgets = Object.fromEntries(manifest.widgets.map((w) => [w.key, w]));
const contents = {};
const features = {};
for (const language of LANGUAGES) {
  contents[language] = {
    stove: buildStoveWidget({ stove, id, feature, language, showChart: true }),
    consumption: buildConsumptionWidget({ stove, daily, language }),
  };
  // What the front reads for the device-bound tiles and the chart legend:
  // the features of the device, named in the language of the integration.
  const device = buildDevice(gladys, { id, host: '192.168.1.40', stove, language });
  features[language] = Object.fromEntries(
    device.features
      .filter((f) => f.external_id === ROOM || f.external_id === SETPOINT)
      .map((f) => [
        f.external_id,
        {
          name: f.name,
          unit: f.unit,
          last_value: f.external_id === ROOM ? stove.mainTemperature : stove.setpoint,
        },
      ]),
  );
}
const cards = Object.fromEntries(
  Object.keys(contents.en).map((key) => [
    key,
    { icon: widgets[key].icon, label: widgets[key].label },
  ]),
);
writeFileSync(
  out,
  JSON.stringify({ now: NOW.getTime(), cards, contents, features, history: HISTORY }, null, 1),
);
console.log(
  'ok',
  Object.keys(contents.en).join(', '),
  `room ${HISTORY[ROOM].length} points, daily`,
  daily.map((d) => d.kg).join(' '),
);
