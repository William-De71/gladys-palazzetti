// Minimal stand-in for the Gladys SDK instance, exposing only what the modules
// under test call. Keeping it tiny is deliberate: a fake that mirrors the whole
// SDK would pass even when the real contract changed.

/**
 * @description Build a fake Gladys SDK instance.
 * @param {string} [selector] - The integration selector.
 * @returns {object} The fake instance.
 */
export function fakeGladys(selector = 'palazzetti') {
  return {
    externalIds: (type, platformId) => {
      const device = `ext:${selector}:${type}:${platformId}`;
      return { device, feature: (key) => `${device}:${key}` };
    },
  };
}
