// -----------------------------------------------------------------------------
// Discovery of the Connection Boxes, and the stable identity of a stove.
//
// A box answers the UDP probe `plzbridge?`, broadcast on port 54549, with its
// static data (the GET STDT envelope) in unicast towards the emitter. The
// integration container cannot broadcast on the LAN: the probe goes through
// the core (`udp-active-broadcast`, declared in the manifest), which relays the
// raw replies.
//
// The device id is the MAC of the box (Wi-Fi first: `MAC` follows the active
// interface), the serial number when no MAC is valid. Never the IP (DHCP) nor
// the LABEL (renamable from the Palazzetti app).
// -----------------------------------------------------------------------------

import { DISCOVERY_PROBE } from './constants.js';

/**
 * @description The payload of the discovery probe.
 * @returns {Buffer} `plzbridge?`, no line ending.
 * @example
 * gladys.scanNetwork('udp-active-broadcast', { port: 54549, payload: discoveryProbe() });
 */
export function discoveryProbe() {
  return Buffer.from(DISCOVERY_PROBE, 'ascii');
}

/**
 * @description Normalize a MAC address, null when it is not a real one.
 * @param {unknown} raw - `40:F3:85:71:23:45`, `--`, ''…
 * @returns {string|null} `40f385712345`.
 * @example
 * normalizeMac('40:F3:85:71:23:45'); // '40f385712345'
 */
export function normalizeMac(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  const hex = raw.replace(/[^0-9a-f]/gi, '').toLowerCase();
  if (hex.length !== 12 || /^0+$/.test(hex) || /^f+$/.test(hex)) {
    return null;
  }
  return hex;
}

/**
 * @description The stable id of a stove, from its static data.
 * @param {object} stdt - GET STDT data (or the discovery reply).
 * @returns {string|null} The id, null when the box gives none.
 * @example
 * stoveId({ WMAC: '40:F3:85:71:23:45' }); // '40f385712345'
 */
export function stoveId(stdt) {
  for (const key of ['WMAC', 'MAC', 'EMAC']) {
    const mac = normalizeMac(stdt?.[key]);
    if (mac) {
      return mac;
    }
  }
  const serial = typeof stdt?.SN === 'string' ? stdt.SN.trim() : '';
  if (serial && serial !== '--' && /^[a-z0-9]+$/i.test(serial)) {
    return `sn${serial.toLowerCase()}`;
  }
  return null;
}

/**
 * @description Read the raw replies of a discovery scan.
 * @param {Array<{ source_ip: string, payload_base64: string }>} replies - Raw results.
 * @returns {Array<{ host: string, id: string, stdt: object }>} One entry per box.
 * @example
 * parseDiscoveryReplies(await gladys.scanNetwork('udp-active-broadcast', options));
 */
export function parseDiscoveryReplies(replies) {
  const boxes = new Map();
  for (const reply of Array.isArray(replies) ? replies : []) {
    let body;
    try {
      body = JSON.parse(Buffer.from(reply.payload_base64 ?? '', 'base64').toString('utf8'));
    } catch {
      continue;
    }
    if (body?.SUCCESS !== true || !body.DATA || typeof reply.source_ip !== 'string') {
      continue;
    }
    const id = stoveId(body.DATA);
    if (id && !boxes.has(id)) {
      boxes.set(id, { host: reply.source_ip, id, stdt: body.DATA });
    }
  }
  return [...boxes.values()];
}
