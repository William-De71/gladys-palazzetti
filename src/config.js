// -----------------------------------------------------------------------------
// Integration configuration.
//
// The user-facing values come from the `config_schema` of the manifest; the SDK
// fetches them (`gladys.getConfig()`) and notifies changes through
// `gladys.onConfigUpdated()`.
//
// This module provides the defaults, normalizes the received object (a numeric
// field arrives as a string from the form) and parses the free-text field of the
// stoves added by hand. Keys stored by the integration itself (outside the
// schema) are listed in INTERNAL_KEYS.
// -----------------------------------------------------------------------------

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (pinned by the manifest test).
export const DEFAULT_CONFIG = {
  poll_interval: 30, // seconds between two reads of each stove
};

export const POLL_INTERVAL_BOUNDS = { min: 10, max: 300 };

// Values the integration stores through `setConfig`, outside the schema.
export const INTERNAL_KEYS = {
  // Language of the last widget request: names of the discovered features.
  language: 'ui_language',
};

const SUPPORTED_LANGUAGES = ['en', 'fr', 'de', 'es'];

/**
 * Parse the "stoves added by hand" field: addresses separated by commas,
 * spaces or new lines. A scheme or a path pasted from the browser is dropped:
 * only the host (and an optional port) is kept.
 * @param {unknown} raw - The raw field value.
 * @returns {string[]} The distinct hosts, as `host` or `host:port`.
 * @example
 * parseHosts('192.168.1.40, http://192.168.1.41/cgi-bin/'); // ['192.168.1.40', '192.168.1.41']
 */
export function parseHosts(raw) {
  if (typeof raw !== 'string') {
    return [];
  }
  const hosts = raw
    .split(/[\s,;]+/)
    .map((entry) =>
      entry
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/\/.*$/, ''),
    )
    .filter((entry) => /^[a-z0-9.-]+(:\d{1,5})?$/i.test(entry))
    .map((entry) => entry.toLowerCase());
  return [...new Set(hosts)];
}

/**
 * Clamp the poll interval within the bounds the manifest declares.
 * @param {unknown} raw - The raw value (a string from the form).
 * @returns {number} The interval, in seconds.
 * @example
 * readPollInterval('5'); // 10
 */
export function readPollInterval(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return DEFAULT_CONFIG.poll_interval;
  }
  return Math.min(POLL_INTERVAL_BOUNDS.max, Math.max(POLL_INTERVAL_BOUNDS.min, Math.round(value)));
}

/**
 * Read the stored language, falling back to the current one.
 * @param {Record<string, unknown>} raw - Config returned by the SDK.
 * @param {string} fallback - The language to keep when none is stored.
 * @returns {string} A language Gladys supports.
 * @example
 * readLanguage({ ui_language: 'fr' }, 'en'); // 'fr'
 */
export function readLanguage(raw, fallback) {
  const stored = raw?.[INTERNAL_KEYS.language];
  return SUPPORTED_LANGUAGES.includes(stored) ? stored : fallback;
}

/**
 * Normalize a language sent by Gladys into one the integration translates.
 * @param {unknown} language - The language (`fr`, `fr-FR`…).
 * @returns {string} `en`, `fr`, `de` or `es`.
 * @example
 * normalizeLanguage('de-AT'); // 'de'
 */
export function normalizeLanguage(language) {
  const short = typeof language === 'string' ? language.slice(0, 2).toLowerCase() : '';
  return SUPPORTED_LANGUAGES.includes(short) ? short : 'en';
}

/**
 * Merge the user config with the defaults and force the types.
 * @param {Record<string, unknown>} [raw] - Config returned by the SDK.
 * @returns {{ pollInterval: number, hosts: string[] }} The normalized configuration.
 * @example
 * const config = normalizeConfig(await gladys.getConfig());
 */
export function normalizeConfig(raw = {}) {
  return {
    pollInterval: readPollInterval(raw.poll_interval ?? DEFAULT_CONFIG.poll_interval),
    hosts: parseHosts(raw.hosts),
  };
}
