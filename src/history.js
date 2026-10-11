// -----------------------------------------------------------------------------
// Daily history of the pellets a stove burns.
//
// The stove only reports a cumulative counter (PQT, kg). To draw "kg per day",
// the integration keeps the counter at the end of each day, per stove, in
// /data (the only writable place of the sandbox): `{ days: { 'YYYY-MM-DD':
// { first, last } } }`, 400 days at most.
//
// The counter is noisy on some boards (pypalazzetti `pellet_quantity_sanitize`):
// a small drop is a glitch and is ignored; a big drop is a reset (service) and
// starts a new count. Days are local to the Gladys time zone (TZ is passed to
// the container by the supervisor).
// -----------------------------------------------------------------------------

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_DAYS = 400;
// Below this drop (kg) a lower counter is a glitch, above it a reset.
const RESET_DROP_KG = 50;
const SAVE_DELAY_MS = 60000;

/**
 * @description The local day of an instant.
 * @param {Date} date - The instant.
 * @returns {string} `YYYY-MM-DD`.
 * @example
 * dayOf(new Date(2026, 9, 12)); // '2026-10-12'
 */
export function dayOf(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * @description Record a reading in a history (pure).
 * @param {{ days: object }} history - The history.
 * @param {number} counter - The counter (kg).
 * @param {Date} date - When it was read.
 * @returns {boolean} true when the history changed.
 * @example
 * record(history, 1807, new Date());
 */
export function record(history, counter, date) {
  if (!Number.isFinite(counter) || counter < 0) {
    return false;
  }
  const day = dayOf(date);
  const days = history.days;
  const known = Object.keys(days).sort();
  const lastDay = known[known.length - 1];
  const latest = lastDay ? days[lastDay].last : null;

  if (latest !== null && counter < latest && latest - counter < RESET_DROP_KG) {
    return false; // glitch
  }
  if (!days[day]) {
    days[day] = { first: counter, last: counter };
  } else if (counter < days[day].last) {
    // Reset during the day: what was burnt before stays counted.
    days[day] = { first: counter, last: counter, before: dailyOf(history, day) };
  } else if (days[day].last === counter) {
    return false;
  } else {
    days[day].last = counter;
  }
  for (const old of Object.keys(days).sort().slice(0, -MAX_DAYS)) {
    delete days[old];
  }
  return true;
}

/**
 * @description The kg burnt on a recorded day.
 * @param {{ days: object }} history - The history.
 * @param {string} day - `YYYY-MM-DD`.
 * @returns {number|null} The kg, null when the day is not recorded.
 */
function dailyOf(history, day) {
  const entry = history.days[day];
  if (!entry) {
    return null;
  }
  const previousDays = Object.keys(history.days)
    .filter((other) => other < day)
    .sort();
  const previous = history.days[previousDays[previousDays.length - 1]];
  // From the end of the previous recorded day when the counter went on from
  // there, from the first reading of the day otherwise (first day, reset).
  const base =
    previous && previous.last <= entry.first && entry.before === undefined
      ? previous.last
      : entry.first;
  return Math.max(0, entry.last - base) + (entry.before ?? 0);
}

/**
 * @description The kg burnt per day over the last days.
 * @param {{ days: object }} history - The history.
 * @param {Date} now - Now.
 * @param {number} count - How many days, today included.
 * @returns {Array<{ day: string, kg: number|null }>} Oldest first; null for a
 * day without readings.
 * @example
 * dailyBurn(history, new Date(), 14);
 */
export function dailyBurn(history, now, count) {
  const result = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset, 12);
    const day = dayOf(date);
    result.push({ day, kg: dailyOf(history, day) });
  }
  return result;
}

/**
 * @description The store of the histories, one file per stove under `dir`.
 * @param {object} options - Options.
 * @param {string} options.dir - The directory (/data in production).
 * @param {object} [options.logger] - The logger.
 * @param {number} [options.saveDelayMs] - Delay grouping the writes.
 * @returns {object} The store: `get(id)`, `add(id, counter, date)`, `flush()`.
 * @example
 * const store = createHistoryStore({ dir: '/data' });
 * await store.add(id, stove.pelletsConsumed, new Date());
 */
export function createHistoryStore({ dir, logger, saveDelayMs = SAVE_DELAY_MS }) {
  const histories = new Map();
  const dirty = new Set();
  let timer = null;

  const file = (id) => path.join(dir, `pellets-${id}.json`);

  const load = async (id) => {
    if (histories.has(id)) {
      return histories.get(id);
    }
    let history = { days: {} };
    try {
      const parsed = JSON.parse(await readFile(file(id), 'utf8'));
      if (parsed && typeof parsed.days === 'object' && parsed.days !== null) {
        history = { days: parsed.days };
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger?.warn(`Unable to read the pellet history of ${id}: ${err.message}`);
      }
    }
    histories.set(id, history);
    return history;
  };

  const flush = async () => {
    clearTimeout(timer);
    timer = null;
    const ids = [...dirty];
    dirty.clear();
    await mkdir(dir, { recursive: true }).catch(() => {});
    for (const id of ids) {
      try {
        // Write then rename: a crash never leaves half a file.
        const tmp = `${file(id)}.tmp`;
        await writeFile(tmp, JSON.stringify(histories.get(id)));
        await rename(tmp, file(id));
      } catch (err) {
        logger?.warn(`Unable to save the pellet history of ${id}: ${err.message}`);
      }
    }
  };

  return {
    get: load,
    async add(id, counter, date) {
      const history = await load(id);
      if (record(history, counter, date)) {
        dirty.add(id);
        timer ??= setTimeout(() => flush().catch(() => {}), saveDelayMs);
      }
    },
    flush,
  };
}
