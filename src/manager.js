// -----------------------------------------------------------------------------
// The stoves the integration knows, and the loop reading them.
//
// A stove comes from three sources, merged by its id (MAC of the box): the
// devices already created (their IP_ADDRESS param), the addresses typed in the
// configuration, and the UDP discovery. Each one is read on a loop:
//   - GET ALLS  every `pollInterval` (status, temperatures, setpoint…);
//   - GET CNTR  every 10 minutes (counters);
//   - GET STDT  at the first read and once a day (model, fans, bounds).
// The box has no push: the loop is what makes the scenes react.
//
// When a box stops answering (its DHCP lease changed), a UDP discovery finds it
// again by its id and the new address is kept, at most every 5 minutes (the
// core allows one scan per 10 s).
// -----------------------------------------------------------------------------

import { createClient } from './palazzetti/client.js';
import { DISCOVERY_PORT } from './palazzetti/constants.js';
import { discoveryProbe, parseDiscoveryReplies, stoveId } from './palazzetti/discovery.js';
import { readStove } from './palazzetti/stove.js';

const COUNTERS_EVERY_MS = 10 * 60 * 1000;
const STATIC_EVERY_MS = 24 * 60 * 60 * 1000;
const REDISCOVER_EVERY_MS = 5 * 60 * 1000;
// Reads in a row without an answer before a stove is declared unreachable.
const FAILURES_BEFORE_LOST = 3;
// The box takes about 10 s to show the effect of a command in GET ALLS.
const REFRESH_AFTER_COMMAND_MS = 12000;
const SCAN_TIMEOUT_SECONDS = 5;

/**
 * @description Create the manager.
 * @param {object} options - Options.
 * @param {Function} options.scan - `(options) => Promise<replies>`: the
 * mediated `udp-active-broadcast` scan of the SDK.
 * @param {Function} options.getIntervalMs - The poll interval.
 * @param {Function} options.onRead - `(entry, previous) => Promise`: after
 * each successful read; `previous` is the former read (null the first time).
 * @param {Function} options.onReachability - `(entry, reachable) => Promise`:
 * a stove became unreachable, or answers again.
 * @param {Function} options.onHostChanged - `(entry) => Promise`: the address
 * of a known stove changed.
 * @param {Function} [options.clientFactory] - createClient, for the tests.
 * @param {Function} [options.now] - Date.now, for the tests.
 * @param {object} options.logger - The logger.
 * @returns {object} The manager.
 * @example
 * const manager = createManager({ scan, getIntervalMs, onRead, onReachability, onHostChanged, logger });
 */
export function createManager({
  scan,
  getIntervalMs,
  onRead,
  onReachability,
  onHostChanged,
  clientFactory = createClient,
  now = Date.now,
  logger,
}) {
  /** @type {Map<string, object>} */
  const stoves = new Map();
  let timer = null;
  let running = false;
  let lastRediscovery = 0;
  let rounds = Promise.resolve();

  const entryFor = (id, host) => {
    let entry = stoves.get(id);
    if (!entry) {
      entry = {
        id,
        host,
        client: clientFactory({ host }),
        stdt: null,
        alls: null,
        cntr: null,
        stove: null,
        readAt: 0,
        stdtAt: 0,
        cntrAt: 0,
        failures: 0,
        reachable: null,
        lastError: null,
      };
      stoves.set(id, entry);
    } else if (host && entry.host !== host) {
      entry.host = host;
      entry.client = clientFactory({ host });
    }
    return entry;
  };

  /**
   * @description Run the discovery probe through the core.
   * @returns {Promise<Array<object>>} The boxes found, `[]` when the scan fails.
   */
  const discoverBoxes = async () => {
    try {
      const replies = await scan({
        port: DISCOVERY_PORT,
        payload: discoveryProbe(),
        timeoutSeconds: SCAN_TIMEOUT_SECONDS,
      });
      return parseDiscoveryReplies(replies);
    } catch (err) {
      logger.warn(`Discovery scan failed: ${err.message}`);
      return [];
    }
  };

  /**
   * @description Read a stove: ALLS, and STDT / CNTR when they are due.
   * @param {object} entry - The stove entry.
   * @param {object} [options] - Options.
   * @param {boolean} [options.full] - Read CNTR whatever its age (STDT is read
   * when missing or a day old).
   * @returns {Promise<object>} The entry.
   * @throws {Error} When the box does not answer.
   */
  const read = async (entry, { full = false } = {}) => {
    const previous = entry.stove;
    try {
      if (!entry.stdt || now() - entry.stdtAt > STATIC_EVERY_MS) {
        entry.stdt = await entry.client.send('GET STDT');
        entry.stdtAt = now();
      }
      entry.alls = { ...entry.alls, ...(await entry.client.send('GET ALLS')) };
      if (full || now() - entry.cntrAt > COUNTERS_EVERY_MS) {
        try {
          entry.cntr = await entry.client.send('GET CNTR');
        } catch (err) {
          // Some boards have no counters: never fatal.
          logger.debug(`${entry.id}: no counters (${err.message})`);
          entry.cntr ??= {};
        }
        entry.cntrAt = now();
      }
    } catch (err) {
      entry.failures += 1;
      entry.lastError = err;
      if (entry.failures >= FAILURES_BEFORE_LOST && entry.reachable !== false) {
        entry.reachable = false;
        await onReachability(entry, false);
      }
      throw err;
    }
    entry.failures = 0;
    entry.lastError = null;
    entry.stove = readStove(entry);
    entry.readAt = now();
    const wasReachable = entry.reachable;
    entry.reachable = true;
    if (wasReachable === false) {
      await onReachability(entry, true);
    }
    await onRead(entry, previous);
    return entry;
  };

  /**
   * @description Look for the stoves that stopped answering at another address.
   * @returns {Promise<void>}
   */
  const rediscover = async () => {
    const lost = [...stoves.values()].filter((entry) => entry.failures >= FAILURES_BEFORE_LOST);
    if (lost.length === 0 || now() - lastRediscovery < REDISCOVER_EVERY_MS) {
      return;
    }
    lastRediscovery = now();
    for (const box of await discoverBoxes()) {
      const entry = stoves.get(box.id);
      if (entry && entry.host !== box.host) {
        logger.info(`${box.id}: the Connection Box moved from ${entry.host} to ${box.host}`);
        entryFor(box.id, box.host);
        await onHostChanged(entry);
      }
    }
  };

  const round = async () => {
    for (const entry of stoves.values()) {
      try {
        await read(entry);
      } catch (err) {
        logger.warn(`${entry.host}: ${err.message}`);
      }
    }
    await rediscover();
  };

  const schedule = () => {
    clearTimeout(timer);
    if (running) {
      timer = setTimeout(() => {
        manager.round().finally(schedule);
      }, getIntervalMs());
    }
  };

  const manager = {
    stoves,

    /**
     * @description Register a stove known by its id (a created device).
     * @param {string} id - The stove id.
     * @param {string} host - The address of its box.
     * @returns {object} The entry.
     */
    register(id, host) {
      return entryFor(id, host);
    },

    /**
     * @description Forget the stoves not in a list of ids.
     * @param {Set<string>} keep - The ids to keep.
     */
    retain(keep) {
      for (const id of stoves.keys()) {
        if (!keep.has(id)) {
          stoves.delete(id);
        }
      }
    },

    /**
     * @description Find the stoves: UDP discovery, typed addresses and known
     * stoves, each one read in full.
     * @param {string[]} hosts - The addresses typed in the configuration.
     * @returns {Promise<{ found: object[], failed: Array<{ host: string, error: Error }> }>}
     * The stoves that answered, and the addresses that did not.
     */
    async discover(hosts) {
      const candidates = new Map(); // host -> id (null when unknown yet)
      for (const box of await discoverBoxes()) {
        // The UDP reply IS the static data: no GET STDT needed.
        Object.assign(entryFor(box.id, box.host), { stdt: box.stdt, stdtAt: now() });
        candidates.set(box.host, box.id);
      }
      for (const entry of stoves.values()) {
        if (!candidates.has(entry.host)) {
          candidates.set(entry.host, entry.id);
        }
      }
      for (const host of hosts) {
        if (!candidates.has(host)) {
          candidates.set(host, null);
        }
      }
      const found = [];
      const failed = [];
      for (const [host, knownId] of candidates) {
        try {
          let id = knownId;
          if (!id) {
            const stdt = await clientFactory({ host }).send('GET STDT');
            id = stoveId(stdt);
            if (!id) {
              throw new Error('the Connection Box gives no MAC address nor serial number');
            }
            Object.assign(entryFor(id, host), { stdt, stdtAt: now() });
          }
          found.push(await read(entryFor(id, host), { full: true }));
        } catch (err) {
          failed.push({ host, error: err });
        }
      }
      return { found, failed };
    },

    /**
     * @description A recent read of a stove, read again when older than `maxAgeMs`.
     * @param {string} id - The stove id.
     * @param {number} maxAgeMs - Maximum age of the read.
     * @returns {Promise<object>} The entry.
     * @throws {Error} Unknown stove, or the box does not answer.
     */
    async get(id, maxAgeMs) {
      const entry = stoves.get(id);
      if (!entry) {
        throw new Error(`Unknown stove: ${id}`);
      }
      if (!entry.stove || now() - entry.readAt > maxAgeMs) {
        await read(entry);
      }
      return entry;
    },

    /**
     * @description Send commands to a stove, in order, then read it again
     * once the box shows their effect.
     * @param {string} id - The stove id.
     * @param {string[]} commands - The commands.
     * @returns {Promise<object>} The entry, with the answers merged.
     */
    async send(id, commands) {
      const entry = stoves.get(id);
      if (!entry) {
        throw new Error(`Unknown stove: ${id}`);
      }
      for (const command of commands) {
        logger.info(`${entry.host}: ${command}`);
        // The answer carries the fields the command changed.
        const data = await entry.client.send(command);
        entry.alls = { ...entry.alls, ...data };
      }
      if (commands.length > 0 && entry.stdt) {
        const previous = entry.stove;
        entry.stove = readStove(entry);
        await onRead(entry, previous);
        setTimeout(() => read(entry).catch(() => {}), REFRESH_AFTER_COMMAND_MS).unref?.();
      }
      return entry;
    },

    /**
     * @description Run one round now (queued after a running one).
     * @returns {Promise<void>}
     */
    round() {
      rounds = rounds.then(round, round);
      return rounds;
    },

    start() {
      running = true;
      manager.round().finally(schedule);
    },

    /** Apply a new poll interval. */
    reschedule() {
      schedule();
    },

    stop() {
      running = false;
      clearTimeout(timer);
    },
  };
  return manager;
}
