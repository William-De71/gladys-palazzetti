// -----------------------------------------------------------------------------
// Scene events of the integration.
//
// `detectEvents` compares two successive reads of a stove and says what
// happened; `buildSceneEvent` writes the flat `data` the core matches against
// the scene triggers. Every event carries:
//   - `stove`       the device external id: the value of the "Stove" filter
//                   (a `source: "devices"` select);
//   - `stove_name`  the name of the stove;
// plus the details of the event and a ready-to-send `summary`.
//
// One event per transition, never one per read: the first read after a start
// is the baseline and fires nothing.
// -----------------------------------------------------------------------------

import { PHASES } from './palazzetti/constants.js';
import { pelletsLow } from './palazzetti/stove.js';
import { t, alarmLabel, statusLabel, formatTemperature } from './i18n.js';

// Keys of the manifest `scene_triggers`: never rename one.
export const SCENE_TRIGGERS = {
  PHASE_CHANGED: 'phase_changed',
  ALARM_RAISED: 'alarm_raised',
  ALARM_CLEARED: 'alarm_cleared',
  PELLETS_LOW: 'pellets_low',
  CONNECTION_LOST: 'connection_lost',
  CONNECTION_RESTORED: 'connection_restored',
};

const MAX_TEXT = 1000;
const clip = (value) => String(value ?? '').slice(0, MAX_TEXT);

/**
 * @description What happened between two reads of a stove.
 * @param {object|null} previous - The previous read (see readStove), null for
 * the first one.
 * @param {object} current - The new read.
 * @returns {Array<object>} The events `{ key, previous, current }`.
 * @example
 * detectEvents(before, after); // [{ key: 'phase_changed', ... }]
 */
export function detectEvents(previous, current) {
  if (!previous || current.status === null || previous.status === null) {
    return [];
  }
  const events = [];
  if (current.phase !== previous.phase) {
    events.push({ key: SCENE_TRIGGERS.PHASE_CHANGED, previous, current });
  }
  if (current.alarm && (!previous.alarm || previous.alarmCode !== current.alarmCode)) {
    events.push({ key: SCENE_TRIGGERS.ALARM_RAISED, previous, current });
  }
  if (previous.alarm && !current.alarm) {
    events.push({ key: SCENE_TRIGGERS.ALARM_CLEARED, previous, current });
  }
  if (pelletsLow(current) === true && pelletsLow(previous) === false) {
    events.push({ key: SCENE_TRIGGERS.PELLETS_LOW, previous, current });
  }
  return events;
}

/**
 * @description Build the data of a scene event.
 * @param {object} options - Options.
 * @param {string} options.deviceExternalId - The device external id.
 * @param {string} options.name - The stove name.
 * @param {object} options.event - An event of detectEvents, or
 * `{ key: 'connection_lost' | 'connection_restored', current? }`.
 * @param {string} options.language - Language of the labels and summary.
 * @returns {{ key: string, data: object }} The event.
 * @example
 * const { key, data } = buildSceneEvent({ deviceExternalId, name, event, language: 'fr' });
 * await gladys.publishSceneEvent(key, data);
 */
export function buildSceneEvent({ deviceExternalId, name, event, language }) {
  const { previous, current } = event;
  const data = { stove: deviceExternalId, stove_name: clip(name) };
  switch (event.key) {
    case SCENE_TRIGGERS.PHASE_CHANGED: {
      const from = t(`phase_${previous.phase}`, language);
      const to = t(`phase_${current.phase}`, language);
      Object.assign(data, {
        phase: current.phase,
        previous_phase: previous.phase,
        phase_label: clip(to),
        status_code: current.status,
        status_label: clip(statusLabel(current.status, language)),
        temperature: current.mainTemperature,
        setpoint: current.setpoint,
        summary: clip(t('summaryPhase', language, { name, from, to })),
      });
      break;
    }
    case SCENE_TRIGGERS.ALARM_RAISED: {
      const alarm = alarmLabel(current.alarmCode, language);
      Object.assign(data, {
        alarm_type: current.alarmType,
        alarm_code: current.alarmCode,
        alarm_label: clip(alarm),
        summary: clip(t('summaryAlarm', language, { name, alarm })),
      });
      break;
    }
    case SCENE_TRIGGERS.ALARM_CLEARED: {
      const alarm = alarmLabel(previous.alarmCode, language);
      Object.assign(data, {
        alarm_code: previous.alarmCode,
        alarm_label: clip(alarm),
        phase: current.phase,
        summary: clip(t('summaryAlarmCleared', language, { name, alarm })),
      });
      break;
    }
    case SCENE_TRIGGERS.PELLETS_LOW:
      Object.assign(data, {
        pellet_level: current.pelletLevel,
        summary: clip(t('summaryPelletLow', language, { name })),
      });
      break;
    case SCENE_TRIGGERS.CONNECTION_LOST:
      data.summary = clip(t('summaryLost', language, { name }));
      break;
    case SCENE_TRIGGERS.CONNECTION_RESTORED:
      Object.assign(data, {
        phase: current?.phase ?? PHASES.UNKNOWN,
        temperature: current?.mainTemperature ?? null,
        summary: clip(t('summaryRestored', language, { name })),
      });
      break;
    default:
      break;
  }
  return { key: event.key, data };
}

/**
 * @description A sentence describing the state of a stove.
 * @param {string} name - The stove name.
 * @param {object} stove - The stove (see readStove).
 * @param {string} language - The language.
 * @returns {string} The sentence.
 * @example
 * describeStove('Salon', stove, 'fr'); // 'Salon : Combustion, 20,5 °C pour une consigne de 21 °C.'
 */
export function describeStove(name, stove, language) {
  const status = stove.alarm
    ? alarmLabel(stove.alarmCode, language)
    : statusLabel(stove.status, language);
  return t('summaryStatus', language, {
    name,
    status,
    temperature: formatTemperature(stove.mainTemperature, language),
    setpoint:
      stove.setpoint === null
        ? t('noSetpoint', language)
        : formatTemperature(stove.setpoint, language),
  });
}
