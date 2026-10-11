// -----------------------------------------------------------------------------
// Entry point of the Palazzetti external integration.
//
// Palazzetti pellet stoves equipped with a Connection Box answer a local HTTP
// API (`/cgi-bin/sendmsg.lua`): no cloud, no account. This integration brings
// them into Gladys:
//   - a device per stove (Discovery screen): on/off, setpoint, power, fans,
//     temperatures, status, alarm, pellets and counters (see device.js);
//   - scene triggers: the stove changes state, an alarm is raised or cleared,
//     the pellets run low, the stove is lost or found again (events.js);
//   - scene actions: read the stove, set it in one action (scene-actions.js);
//   - dashboard widgets: the stove, the pellet consumption (widgets.js).
//
// The boxes are found by a UDP probe the core broadcasts for the integration
// (manifest `network_discovery`), or by the addresses typed in the settings.
// The box has no push: the stoves are read on a loop (manager.js).
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
//   TZ (the time zone of Gladys: local days of the history, stove clock)
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { INTERNAL_KEYS, normalizeConfig, normalizeLanguage, readLanguage } from './src/config.js';
import { createManager } from './src/manager.js';
import { createHistoryStore, dailyBurn } from './src/history.js';
import { PARAMS, buildDevice, buildStates, idsOf, parseExternalId } from './src/device.js';
import {
  CommandError,
  clockCommand,
  featureCommands,
  setpointCommand,
  powerCommand,
  switchCommand,
} from './src/commands.js';
import { SCENE_TRIGGERS, buildSceneEvent, detectEvents } from './src/events.js';
import {
  SCENE_ACTIONS,
  buildControlOutputs,
  buildStatusOutputs,
  planControl,
} from './src/scene-actions.js';
import {
  WIDGETS,
  WIDGET_ACTIONS,
  buildConsumptionWidget,
  buildStoveWidget,
  messageContent,
  readDays,
} from './src/widgets.js';
import { LANGUAGES, all, t, stateLabel, formatTemperature } from './src/i18n.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const ACTIONS = { TEST_CONNECTION: 'test_connection', SYNC_CLOCK: 'sync_clock' };
// A widget or a scene action reuses a read while it is this fresh.
const FRESH_MS = 15000;
const DATA_DIR = process.env.DATA_DIR || '/data';

const gladys = new GladysIntegration();

let config = normalizeConfig();
// Language of the last widget request: names of the features, status text,
// scene summaries.
let language = 'en';
// Devices the user created, by stove id.
let createdDevices = new Map();
// Devices offered on the Discovery screen, by stove id.
const discovered = new Map();
// Last state published per feature, to publish changes only.
const lastStates = new Map();
let lastStatus = null;

const history = createHistoryStore({ dir: DATA_DIR, logger });

// --- Helpers ---------------------------------------------------------------------

/**
 * @description Remember the language of a request, and store it when it changed.
 * @param {unknown} next - The language.
 */
function rememberLanguage(next) {
  const normalized = normalizeLanguage(next);
  if (normalized === language) {
    return;
  }
  language = normalized;
  gladys
    .setConfig({ [INTERNAL_KEYS.language]: normalized })
    .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
}

/**
 * @description The name of a stove: the name the user gave its device, the
 * LABEL of the box, or a default one.
 * @param {object} entry - The manager entry.
 * @param {string} [lang] - The language of the default name.
 * @returns {string} The name.
 */
function nameOf(entry, lang = language) {
  return createdDevices.get(entry.id)?.name ?? entry.stove?.name ?? t('defaultName', lang);
}

/**
 * @description Report the connection status, only when it changed.
 * @returns {Promise<void>}
 */
async function reportStatus() {
  const entries = [...manager.stoves.values()].filter((entry) => entry.reachable !== null);
  let connected = false;
  let message;
  if (manager.stoves.size === 0) {
    message = all('statusNoStove');
  } else if (entries.length === 0) {
    return; // first reads still running
  } else {
    const down = entries.filter((entry) => !entry.reachable);
    connected = down.length < entries.length;
    if (down.length === 0) {
      message = all('statusConnected', { count: entries.length });
    } else if (connected) {
      message = all('statusPartial', {
        ok: entries.length - down.length,
        count: entries.length,
        names: down.map((entry) => nameOf(entry)).join(', '),
      });
    } else {
      message = all('statusNone');
    }
  }
  const signature = JSON.stringify([connected, message]);
  if (signature === lastStatus) {
    return;
  }
  lastStatus = signature;
  try {
    await gladys.setConnectionStatus(connected, message);
  } catch (err) {
    lastStatus = null;
    logger.error('Unable to report the connection status', err);
  }
}

/**
 * @description Publish the states that changed, for a created device only.
 * @param {object} entry - The manager entry.
 * @returns {Promise<void>}
 */
async function publishStates(entry) {
  if (!createdDevices.has(entry.id) || !entry.stove) {
    return;
  }
  const changed = buildStates(gladys, entry.id, entry.stove, language).filter((state) => {
    const value = state.text ?? state.state;
    if (lastStates.get(state.device_feature_external_id) === value) {
      return false;
    }
    lastStates.set(state.device_feature_external_id, value);
    return true;
  });
  if (changed.length > 0) {
    try {
      await gladys.publishStates(changed);
    } catch (err) {
      // Publish them again next time.
      changed.forEach((state) => lastStates.delete(state.device_feature_external_id));
      logger.warn(`Unable to publish the states of ${entry.id}: ${err.message}`);
    }
  }
}

/**
 * @description Fire a scene event for a created device.
 * @param {object} entry - The manager entry.
 * @param {object} event - The event (see detectEvents).
 * @returns {Promise<void>}
 */
async function publishEvent(entry, event) {
  if (!createdDevices.has(entry.id)) {
    return;
  }
  const { key, data } = buildSceneEvent({
    deviceExternalId: idsOf(gladys, entry.id).device,
    name: nameOf(entry),
    event,
    language,
  });
  logger.info(`${entry.host}: ${key} (${data.summary})`);
  try {
    await gladys.publishSceneEvent(key, data);
  } catch (err) {
    logger.warn(`Unable to publish the scene event ${key}: ${err.message}`);
  }
}

/**
 * @description Offer every known stove on the Discovery screen.
 * @returns {Promise<void>}
 */
async function publishDiscovered() {
  try {
    await gladys.publishDiscoveredDevices([...discovered.values()]);
  } catch (err) {
    logger.warn(`Unable to offer the stoves: ${err.message}`);
  }
}

/**
 * @description Build the discovered device of a stove.
 * @param {object} entry - The manager entry.
 */
function rememberDiscovered(entry) {
  if (entry.stove) {
    discovered.set(
      entry.id,
      buildDevice(gladys, { id: entry.id, host: entry.host, stove: entry.stove, language }),
    );
  }
}

// --- The manager ---------------------------------------------------------------------

const manager = createManager({
  scan: (options) => gladys.scanNetwork('udp-active-broadcast', options),
  getIntervalMs: () => config.pollInterval * 1000,
  onRead: async (entry, previous) => {
    await publishStates(entry);
    for (const event of detectEvents(previous, entry.stove)) {
      await publishEvent(entry, event);
    }
    if (entry.stove.pelletsConsumed !== null) {
      await history.add(entry.id, entry.stove.pelletsConsumed, new Date());
    }
    const moved =
      !previous ||
      ['status', 'setpoint', 'power', 'chrono'].some((key) => previous[key] !== entry.stove[key]) ||
      previous.fans.main?.value !== entry.stove.fans.main?.value;
    if (moved) {
      gladys.requestWidgetRefresh(WIDGETS.STOVE);
    }
    await reportStatus();
  },
  onReachability: async (entry, reachable) => {
    logger.warn(`${entry.host}: ${reachable ? 'answers again' : 'unreachable'}`);
    if (createdDevices.has(entry.id)) {
      await gladys
        .publishTransports([
          {
            external_id: idsOf(gladys, entry.id).device,
            transport: reachable ? 'local' : 'unreachable',
          },
        ])
        .catch((err) => logger.warn(`Unable to publish the transport: ${err.message}`));
    }
    await publishEvent(entry, {
      key: reachable ? SCENE_TRIGGERS.CONNECTION_RESTORED : SCENE_TRIGGERS.CONNECTION_LOST,
      current: entry.stove,
    });
    gladys.requestWidgetRefresh(WIDGETS.STOVE);
    await reportStatus();
  },
  onHostChanged: async (entry) => {
    // Re-publishing a created device upserts its IP_ADDRESS param.
    rememberDiscovered(entry);
    await publishDiscovered();
  },
  logger,
});

/**
 * @description Read the devices the user created, and register their stoves.
 * @returns {Promise<void>}
 */
async function refreshCreatedDevices() {
  try {
    const devices = await gladys.getDevices();
    createdDevices = new Map();
    for (const device of devices) {
      const parsed = parseExternalId(device.external_id);
      const host = device.params?.find((param) => param.name === PARAMS.IP_ADDRESS)?.value;
      if (parsed && host) {
        createdDevices.set(parsed.id, device);
        manager.register(parsed.id, host);
      }
    }
  } catch (err) {
    logger.warn(`Unable to read the devices: ${err.message}`);
  }
}

/**
 * @description Look for the stoves and offer them on the Discovery screen.
 * @returns {Promise<{ found: object[], failed: object[] }>} The result.
 */
async function discoverStoves() {
  const result = await manager.discover(config.hosts);
  for (const entry of result.found) {
    rememberDiscovered(entry);
  }
  for (const { host, error } of result.failed) {
    logger.warn(`${host}: ${error.message}`);
  }
  await publishDiscovered();
  await reportStatus();
  return result;
}

/**
 * @description The stove a widget or a scene action targets.
 * @param {unknown} deviceExternalId - The `source: "devices"` value.
 * @returns {object|null} The manager entry; the first created stove when
 * empty; null when there is none.
 */
function resolveEntry(deviceExternalId) {
  const parsed = parseExternalId(deviceExternalId);
  if (parsed && manager.stoves.has(parsed.id)) {
    return manager.stoves.get(parsed.id);
  }
  const first = [...createdDevices.keys(), ...manager.stoves.keys()].find((id) =>
    manager.stoves.has(id),
  );
  return first ? manager.stoves.get(first) : null;
}

/**
 * @description A fresh read of the stove of a scene action.
 * @param {unknown} deviceExternalId - The "Stove" field.
 * @returns {Promise<object>} The manager entry.
 * @throws {Error} When there is no stove or it does not answer.
 */
async function sceneEntry(deviceExternalId) {
  const entry = resolveEntry(deviceExternalId);
  if (!entry) {
    throw new Error('No Palazzetti stove: add one from the Discover tab of the integration');
  }
  return manager.get(entry.id, FRESH_MS);
}

/**
 * @description Turn a refusal into an Error the core shows as is.
 * @param {Error} err - The error.
 * @returns {Error} The error, in the current language when translated.
 */
function localized(err) {
  if (err instanceof CommandError) {
    return new Error(err.translated[language] ?? err.message);
  }
  return err;
}

// --- Devices -------------------------------------------------------------------------

gladys.onScanRequest(async () => {
  const { found } = await discoverStoves();
  logger.info(`Scan: ${found.length} stove(s) offered`);
});

gladys.onSetValue(async (device, deviceFeature, value) => {
  const parsed = parseExternalId(deviceFeature.external_id);
  if (!parsed?.key) {
    throw new Error(`Unknown feature: ${deviceFeature.external_id}`);
  }
  const host = device.params?.find((param) => param.name === PARAMS.IP_ADDRESS)?.value;
  if (host) {
    manager.register(parsed.id, host);
  }
  try {
    const entry = await manager.get(parsed.id, FRESH_MS);
    await manager.send(parsed.id, featureCommands(entry.stove, parsed.key, value, nameOf(entry)));
  } catch (err) {
    throw localized(err);
  }
});

gladys.onDeviceCreated(async () => {
  await refreshCreatedDevices();
  lastStates.clear();
  for (const entry of manager.stoves.values()) {
    await publishStates(entry);
  }
});

gladys.onDeviceUpdated(refreshCreatedDevices);

gladys.onDeviceDeleted(async () => {
  await refreshCreatedDevices();
  // Keep reading the stoves still offered on the Discovery screen.
  manager.retain(new Set([...createdDevices.keys(), ...discovered.keys()]));
  await reportStatus();
});

// --- Dashboard widgets -----------------------------------------------------------------

gladys.onWidgetGet(WIDGETS.STOVE, async ({ settings = {}, language: lang }) => {
  rememberLanguage(lang);
  const l = normalizeLanguage(lang);
  const entry = resolveEntry(settings.stove);
  if (!entry) {
    return messageContent(t('noStove', l));
  }
  try {
    await manager.get(entry.id, FRESH_MS);
  } catch (err) {
    logger.warn(`Widget: ${err.message}`);
    return messageContent(t('unreachable', l, { name: nameOf(entry, l) }), 60);
  }
  return buildStoveWidget({
    stove: entry.stove,
    id: entry.id,
    feature: idsOf(gladys, entry.id).feature,
    language: l,
    showChart: settings.show_chart !== false && settings.show_chart !== 'false',
  });
});

gladys.onWidgetAction(WIDGETS.STOVE, async (actionKey, params) => {
  const entry = manager.stoves.get(String(params?.stove ?? ''));
  if (!entry) {
    throw new Error('Unknown stove');
  }
  const name = nameOf(entry);
  try {
    const { stove } = await manager.get(entry.id, FRESH_MS);
    switch (actionKey) {
      case WIDGET_ACTIONS.TURN_ON:
      case WIDGET_ACTIONS.TURN_OFF: {
        const on = actionKey === WIDGET_ACTIONS.TURN_ON;
        const command = switchCommand(stove, on, name);
        await manager.send(entry.id, command ? [command] : []);
        return all(on ? 'toastOn' : 'toastOff', { name });
      }
      case WIDGET_ACTIONS.SETPOINT_DOWN:
      case WIDGET_ACTIONS.SETPOINT_UP: {
        const { command, value } = setpointCommand(stove, params.value);
        await manager.send(entry.id, [command]);
        return all('toastSetpoint', { name, value });
      }
      case WIDGET_ACTIONS.POWER_NEXT: {
        const { command, value } = powerCommand(stove, params.value);
        await manager.send(entry.id, [command]);
        return all('toastPower', { name, value });
      }
      default:
        throw new Error(`Unknown widget action: ${actionKey}`);
    }
  } catch (err) {
    if (err instanceof CommandError) {
      // A refusal is an answer, not a failure: shown as the toast.
      return err.translated;
    }
    throw err;
  }
});

gladys.onWidgetGet(WIDGETS.CONSUMPTION, async ({ settings = {}, language: lang }) => {
  rememberLanguage(lang);
  const l = normalizeLanguage(lang);
  const entry = resolveEntry(settings.stove);
  if (!entry) {
    return messageContent(t('noStove', l));
  }
  try {
    await manager.get(entry.id, FRESH_MS);
  } catch (err) {
    logger.warn(`Widget: ${err.message}`);
    return messageContent(t('unreachable', l, { name: nameOf(entry, l) }), 60);
  }
  const daily = dailyBurn(await history.get(entry.id), new Date(), readDays(settings));
  return buildConsumptionWidget({ stove: entry.stove, daily, language: l });
});

// --- Scene actions ---------------------------------------------------------------------

gladys.onSceneAction(SCENE_ACTIONS.GET_STATUS, async (fields) => {
  const entry = await sceneEntry(fields.stove);
  return buildStatusOutputs(nameOf(entry), entry.stove, language);
});

gladys.onSceneAction(SCENE_ACTIONS.CONTROL, async (fields) => {
  const entry = await sceneEntry(fields.stove);
  const name = nameOf(entry);
  try {
    const plan = planControl(entry.stove, fields, name);
    await manager.send(entry.id, plan.commands);
    return buildControlOutputs(name, plan.changes(language), entry.stove, language);
  } catch (err) {
    throw localized(err);
  }
});

// --- Configuration screen actions --------------------------------------------------------

gladys.onAction(ACTIONS.TEST_CONNECTION, async () => {
  const { found, failed } = await discoverStoves();
  if (found.length === 0 && failed.length === 0) {
    return all('testNothing');
  }
  return Object.fromEntries(
    LANGUAGES.map((lang) => [
      lang,
      [
        ...found.map((entry) =>
          t('testLine', lang, {
            name: nameOf(entry, lang),
            host: entry.host,
            status: stateLabel(entry.stove, lang),
            temperature: formatTemperature(entry.stove.mainTemperature, lang),
          }),
        ),
        ...failed.map(({ host, error }) =>
          t('testFailedLine', lang, { host, reason: error.message }),
        ),
      ].join(' · '),
    ]),
  );
});

gladys.onAction(ACTIONS.SYNC_CLOCK, async (fields = {}) => {
  const parsed = parseExternalId(fields.stove);
  const targets = [...manager.stoves.values()].filter((entry) => !parsed || entry.id === parsed.id);
  if (targets.length === 0) {
    return all('statusNoStove');
  }
  const now = new Date();
  const done = [];
  const failed = [];
  for (const entry of targets) {
    try {
      await manager.send(entry.id, [clockCommand(now)]);
      done.push(nameOf(entry));
    } catch (err) {
      logger.warn(`${entry.host}: unable to set the clock: ${err.message}`);
      failed.push(nameOf(entry));
    }
  }
  if (done.length === 0) {
    throw new Error(t('clockFailed', language, { names: failed.join(', ') }));
  }
  const time = now.toTimeString().slice(0, 5);
  return all('clockSynced', { time, names: done.join(', ') });
});

// --- Configuration -----------------------------------------------------------------------

/**
 * @description Reload the whole config (internal keys included).
 * @param {object} [fallback] - Raw values to use when the read fails.
 * @returns {Promise<void>}
 */
async function loadConfig(fallback) {
  try {
    const raw = await gladys.getConfig();
    config = normalizeConfig(raw);
    language = readLanguage(raw, language);
  } catch (err) {
    if (fallback) {
      config = normalizeConfig(fallback);
    }
    logger.error('Unable to read the configuration', err);
  }
}

gladys.onConfigUpdated(async (rawConfig) => {
  await loadConfig(rawConfig);
  logger.info(
    `Configuration updated: ${config.hosts.length} address(es) typed, read every ${config.pollInterval} s`,
  );
  manager.reschedule();
  await discoverStoves().catch((err) => logger.warn(`Discovery failed: ${err.message}`));
});

// --- Connection lifecycle ----------------------------------------------------------------
// Each step on its own: a failing one must not keep the loop from starting.
gladys.on('connected', async () => {
  await loadConfig();
  await refreshCreatedDevices();
  lastStatus = null;
  lastStates.clear();
  manager.start();
  discoverStoves().catch((err) => logger.warn(`Discovery failed: ${err.message}`));
});

// --- Graceful shutdown -------------------------------------------------------------------
gladys.handleShutdown(async (signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
  manager.stop();
  await history.flush();
});

// --- Startup -------------------------------------------------------------------------------
logger.info(`Starting the Palazzetti integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
