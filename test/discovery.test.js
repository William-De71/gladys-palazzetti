import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  discoveryProbe,
  normalizeMac,
  parseDiscoveryReplies,
  stoveId,
} from '../src/palazzetti/discovery.js';
import { GINGER_STDT } from './helpers/fixtures.js';

const reply = (ip, body) => ({
  source_ip: ip,
  source_port: 54549,
  payload_base64: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)).toString(
    'base64',
  ),
});

test('the probe is the bare plzbridge? the boxes answer', () => {
  assert.equal(discoveryProbe().toString('ascii'), 'plzbridge?');
});

test('a MAC is normalized, placeholders are not MACs', () => {
  assert.equal(normalizeMac('40:F3:85:71:23:45'), '40f385712345');
  assert.equal(normalizeMac('--'), null);
  assert.equal(normalizeMac('00:00:00:00:00:00'), null);
  assert.equal(normalizeMac(undefined), null);
});

test('the stove id prefers the Wi-Fi MAC, then the serial number', () => {
  assert.equal(stoveId(GINGER_STDT), '40f385712345');
  assert.equal(stoveId({ MAC: '--', SN: 'LT123ABC' }), 'snlt123abc');
  assert.equal(stoveId({ MAC: '--', SN: '--' }), null);
});

test('the discovery replies become boxes, junk and duplicates dropped', () => {
  const ok = { INFO: { RSP: 'OK' }, SUCCESS: true, DATA: GINGER_STDT };
  const boxes = parseDiscoveryReplies([
    reply('192.168.1.40', ok),
    reply('192.168.1.40', ok), // the same box answering twice
    reply('192.168.1.41', 'not json'),
    reply('192.168.1.42', { SUCCESS: false }),
  ]);
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].host, '192.168.1.40');
  assert.equal(boxes[0].id, '40f385712345');
  assert.equal(boxes[0].stdt.LABEL, 'Salon');
});
