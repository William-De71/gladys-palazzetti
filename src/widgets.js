// -----------------------------------------------------------------------------
// Dashboard widgets of the integration (pure builders).
//
//   - `stove`        the stove at a glance: room temperature and setpoint
//                    (live tiles), the temperature curve of the day, the state
//                    (status list), and the buttons on/off, −1 °C, +1 °C,
//                    next power level;
//   - `consumption`  the pellets burnt per day (bars), today / per day /
//                    total, and the counters (ignitions, hours, service).
//
// The content budget of the core: at most 8 components, 1 focal (chart),
// 6 tiles, 1 status, 4 buttons. Button action keys are unique per content
// (a duplicated key drops the button).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { PHASES } from './palazzetti/constants.js';
import { pelletsLow } from './palazzetti/stove.js';
import { FEATURE_KEYS, extraProbes } from './device.js';
import { t, fanLabel, formatNumber, stateLabel } from './i18n.js';

// Keys of the manifest `widgets`: never rename one.
export const WIDGETS = { STOVE: 'stove', CONSUMPTION: 'consumption' };

export const WIDGET_ACTIONS = {
  TURN_ON: 'turn_on',
  TURN_OFF: 'turn_off',
  SETPOINT_DOWN: 'setpoint_down',
  SETPOINT_UP: 'setpoint_up',
  POWER_NEXT: 'power_next',
};

export const CONSUMPTION_DAYS = { min: 7, max: 60, default: 14 };
const BAG_KG = 15;

const PHASE_COLORS = {
  [PHASES.OFF]: WIDGET_COLORS.NEUTRAL,
  [PHASES.IGNITION]: WIDGET_COLORS.WARNING,
  [PHASES.HEATING]: WIDGET_COLORS.SUCCESS,
  [PHASES.ECO]: WIDGET_COLORS.INFO,
  [PHASES.COOLING]: WIDGET_COLORS.INFO,
  [PHASES.CLEANING]: WIDGET_COLORS.INFO,
  [PHASES.ALARM]: WIDGET_COLORS.DANGER,
  [PHASES.UNKNOWN]: WIDGET_COLORS.NEUTRAL,
};

/**
 * @description A content made of a single message.
 * @param {string} text - The message.
 * @param {number} [ttl] - Seconds before the core asks again.
 * @returns {object} The content.
 * @example
 * messageContent('No stove yet');
 */
export function messageContent(text, ttl = 300) {
  return { ttl_seconds: ttl, components: [{ type: 'text', text, variant: 'body' }] };
}

/**
 * @description The power level the "next power" button sets: one more, back
 * to 1 after 5.
 * @param {number|null} power - The current level.
 * @returns {number} 1 to 5.
 * @example
 * nextPower(5); // 1
 */
export function nextPower(power) {
  return Number.isInteger(power) && power >= 1 && power < 5 ? power + 1 : 1;
}

/**
 * @description The status rows of a stove.
 * @param {object} stove - The stove (see readStove).
 * @param {string} language - The language.
 * @param {boolean} withPower - Add the power level (when it has no tile).
 * @returns {Array<object>} The rows.
 */
function statusItems(stove, language, withPower) {
  const items = [
    {
      label: t('state', language),
      value: stateLabel(stove, language).slice(0, 40),
      icon: stove.alarm ? 'alert-triangle' : 'activity',
      color: PHASE_COLORS[stove.phase],
    },
  ];
  if (withPower && stove.hasPower && stove.power) {
    items.push({ label: t('power', language), value: `${stove.power} / 5`, icon: 'zap' });
  }
  if (stove.fans.main && Number.isInteger(stove.fans.main.value)) {
    items.push({
      label: t('fan', language),
      value: fanLabel(stove.fans.main.value, language),
      icon: 'wind',
    });
  }
  const exhaust = extraProbes(stove).find((probe) => probe.field === 'T3');
  if (exhaust) {
    items.push({
      label: t('flueGas', language),
      value: `${formatNumber(stove.probes.T3, language, 0)} °C`,
      icon: 'thermometer',
    });
  }
  const low = pelletsLow(stove);
  if (low !== null) {
    items.push({
      label: t('pellets', language),
      value: t(low ? 'pelletsLow' : 'pelletsOk', language),
      icon: 'package',
      color: low ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
    });
  }
  if (stove.hasChrono) {
    items.push({
      label: t('schedule', language),
      value: t(stove.chrono ? 'enabled' : 'disabled', language),
      icon: 'calendar',
    });
  }
  return items;
}

/**
 * @description The content of the `stove` widget.
 * @param {object} options - Options.
 * @param {object} options.stove - The stove (see readStove).
 * @param {string} options.id - The stove id (params of the buttons).
 * @param {Function} options.feature - `(key) => feature external id`.
 * @param {string} options.language - The language.
 * @param {boolean} [options.showChart] - The temperature curve of the day.
 * @returns {object} The content.
 * @example
 * buildStoveWidget({ stove, id, feature: ids.feature, language: 'fr' });
 */
export function buildStoveWidget({ stove, id, feature, language, showChart = true }) {
  const components = [];
  if (stove.mainTemperature !== null) {
    components.push({
      type: 'value',
      label: t(stove.mainProbe.water ? 'water' : 'room', language),
      device_feature: feature(FEATURE_KEYS.ROOM),
      icon: 'thermometer',
    });
  }
  if (stove.hasSetpoint) {
    components.push({
      type: 'value',
      label: t('setpoint', language),
      device_feature: feature(FEATURE_KEYS.SETPOINT),
      icon: 'target',
    });
  }
  if (showChart && stove.mainTemperature !== null) {
    const features = [feature(FEATURE_KEYS.ROOM)];
    if (stove.hasSetpoint) {
      features.push(feature(FEATURE_KEYS.SETPOINT));
    }
    components.push({
      type: 'chart',
      device_features: features,
      interval: 'last-day',
      chart_type: 'line',
      unit: '°C',
    });
  }
  // Without the curve, the power gets a tile (the budget leaves room for three
  // tiles next to the status list and four buttons).
  const powerTile = !showChart && stove.hasPower && Boolean(stove.power);
  if (powerTile) {
    components.push({
      type: 'value',
      label: t('power', language),
      value: stove.power,
      unit: '/ 5',
      icon: 'zap',
    });
  }
  components.push({ type: 'status', items: statusItems(stove, language, !powerTile) });

  const params = { stove: id };
  if (stove.hasSwitch && !stove.alarm) {
    components.push(
      stove.running
        ? {
            type: 'button',
            label: t('turnOff', language),
            icon: 'power',
            style: 'danger',
            action: { key: WIDGET_ACTIONS.TURN_OFF, params, confirm: true },
          }
        : {
            type: 'button',
            label: t('turnOn', language),
            icon: 'power',
            style: 'primary',
            action: { key: WIDGET_ACTIONS.TURN_ON, params },
          },
    );
  }
  if (stove.hasSetpoint) {
    components.push(
      {
        type: 'button',
        label: t('setpointDown', language),
        icon: 'minus',
        style: 'secondary',
        action: {
          key: WIDGET_ACTIONS.SETPOINT_DOWN,
          params: { ...params, value: stove.setpoint - 1 },
        },
      },
      {
        type: 'button',
        label: t('setpointUp', language),
        icon: 'plus',
        style: 'secondary',
        action: {
          key: WIDGET_ACTIONS.SETPOINT_UP,
          params: { ...params, value: stove.setpoint + 1 },
        },
      },
    );
  }
  if (stove.hasPower) {
    const next = nextPower(stove.power);
    components.push({
      type: 'button',
      label: t('powerTo', language, { n: next }),
      icon: 'zap',
      style: 'secondary',
      action: { key: WIDGET_ACTIONS.POWER_NEXT, params: { ...params, value: next } },
    });
  }
  // Fast while something is moving (ignition, shutdown), slower at rest.
  const settled = stove.phase === PHASES.OFF || stove.phase === PHASES.HEATING;
  return { ttl_seconds: settled ? 120 : 30, components };
}

/**
 * @description Read the `consumption` widget settings.
 * @param {object} settings - The settings.
 * @returns {number} The number of days shown.
 * @example
 * readDays({ days: '30' }); // 30
 */
export function readDays(settings) {
  const days = Number(settings?.days);
  if (!Number.isInteger(days)) {
    return CONSUMPTION_DAYS.default;
  }
  return Math.min(CONSUMPTION_DAYS.max, Math.max(CONSUMPTION_DAYS.min, days));
}

/**
 * @description The content of the `consumption` widget.
 * @param {object} options - Options.
 * @param {object} options.stove - The stove (see readStove).
 * @param {Array<{ day: string, kg: number|null }>} options.daily - kg per day,
 * oldest first, today last (see dailyBurn).
 * @param {string} options.language - The language.
 * @returns {object} The content.
 * @example
 * buildConsumptionWidget({ stove, daily: dailyBurn(history, new Date(), 14), language: 'fr' });
 */
export function buildConsumptionWidget({ stove, daily, language }) {
  if (stove.pelletsConsumed === null) {
    return messageContent(t('noPelletCounter', language), 3600);
  }
  const today = daily[daily.length - 1]?.kg ?? null;
  // The average uses the full days only (today is still running).
  const full = daily.slice(0, -1).filter((entry) => entry.kg !== null);
  const average =
    full.length > 0 ? full.reduce((sum, entry) => sum + entry.kg, 0) / full.length : null;
  const components = [];
  components.push(
    {
      type: 'value',
      label: t('today', language),
      value: today === null ? '–' : Math.round(today * 10) / 10,
      unit: 'kg',
      icon: 'sun',
    },
    {
      type: 'value',
      label: t('perDay', language),
      value: average === null ? '–' : Math.round(average * 10) / 10,
      unit: 'kg',
      icon: 'bar-chart-2',
    },
    {
      type: 'value',
      label: t('total', language),
      value: stove.pelletsConsumed,
      unit: 'kg',
      icon: 'package',
    },
  );
  const points = daily
    .filter((entry) => entry.kg !== null)
    .map((entry) => ({ t: `${entry.day}T12:00:00`, v: Math.round(entry.kg * 10) / 10 }));
  if (points.length >= 2) {
    components.push({
      type: 'chart',
      chart_type: 'bar',
      title: t('dailyBurn', language),
      unit: 'kg',
      series: [{ name: t('pellets', language), points }],
    });
  } else {
    components.push({ type: 'text', text: t('noHistory', language), variant: 'caption' });
  }
  const items = [];
  if (average !== null) {
    items.push({
      label: t('bagsPerWeek', language),
      value: formatNumber((average * 7) / BAG_KG, language),
      icon: 'shopping-bag',
    });
  }
  if (stove.ignitions !== null) {
    items.push({ label: t('ignitions', language), value: stove.ignitions, icon: 'zap' });
  }
  if (stove.heatingHours !== null) {
    items.push({
      label: t('heatingHours', language),
      value: t('hours', language, { n: stove.heatingHours }),
      icon: 'clock',
    });
  }
  if (stove.serviceHours !== null) {
    items.push({
      label: t('serviceHours', language),
      value: t('hours', language, { n: stove.serviceHours }),
      icon: 'tool',
    });
  }
  if (items.length > 0) {
    components.push({ type: 'status', items });
  }
  return { ttl_seconds: 900, components };
}
