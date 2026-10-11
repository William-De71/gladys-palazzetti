import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createManager } from '../src/manager.js';
import { PalazzettiError, ERROR_KINDS } from '../src/palazzetti/client.js';
import { GINGER_ALLS, GINGER_STDT } from './helpers/fixtures.js';

const silent = { debug() {}, info() {}, warn() {}, error() {} };

/**
 * @description Fake boxes: host -> { stdt, alls } or 'down'.
 * @param {object} boxes - The boxes.
 * @param {string[]} sent - Log of the commands.
 * @returns {Function} A client factory.
 */
function fakeClients(boxes, sent) {
  return ({ host }) => ({
    host,
    async send(command) {
      sent.push(`${host} ${command}`);
      const box = boxes[host];
      if (!box || box === 'down') {
        throw new PalazzettiError(ERROR_KINDS.UNREACHABLE, `${host} unreachable`);
      }
      if (command === 'GET STDT') return box.stdt;
      if (command === 'GET ALLS') return box.alls;
      if (command === 'GET CNTR') return { IGN: 3 };
      if (command.startsWith('SET SETP')) return { SETP: Number(command.split(' ')[2]) };
      return {};
    },
  });
}

const reply = (ip, stdt) => ({
  source_ip: ip,
  payload_base64: Buffer.from(JSON.stringify({ SUCCESS: true, DATA: stdt })).toString('base64'),
});

test('discovery merges the scan and the typed addresses, by stove id', async () => {
  const sent = [];
  const reads = [];
  const manager = createManager({
    scan: async () => [reply('10.0.0.5', GINGER_STDT)],
    getIntervalMs: () => 30000,
    onRead: async (entry) => reads.push(entry.id),
    onReachability: async () => {},
    onHostChanged: async () => {},
    clientFactory: fakeClients({ '10.0.0.5': { stdt: GINGER_STDT, alls: GINGER_ALLS } }, sent),
    logger: silent,
  });
  // The same box typed by hand, and an address answering nothing.
  const { found, failed } = await manager.discover(['10.0.0.5', '10.0.0.9']);
  assert.equal(found.length, 1);
  assert.equal(found[0].id, '40f385712345');
  assert.equal(found[0].stove.name, 'Salon');
  assert.deepEqual(
    failed.map((entry) => entry.host),
    ['10.0.0.9'],
  );
  assert.deepEqual(reads, ['40f385712345']);
});

test('a box that moved is found again by its id, once it stops answering', async () => {
  const sent = [];
  const boxes = { '10.0.0.5': 'down', '10.0.0.7': { stdt: GINGER_STDT, alls: GINGER_ALLS } };
  const reachability = [];
  const moved = [];
  let now = 0;
  const manager = createManager({
    scan: async () => [reply('10.0.0.7', GINGER_STDT)],
    getIntervalMs: () => 30000,
    onRead: async () => {},
    onReachability: async (entry, reachable) => reachability.push(reachable),
    onHostChanged: async (entry) => moved.push(entry.host),
    clientFactory: fakeClients(boxes, sent),
    now: () => (now += 1000000),
    logger: silent,
  });
  manager.register('40f385712345', '10.0.0.5');
  for (let round = 0; round < 3; round += 1) {
    await manager.round();
  }
  assert.deepEqual(reachability, [false]);
  assert.deepEqual(moved, ['10.0.0.7']);
  await manager.round();
  assert.deepEqual(reachability, [false, true]);
  assert.equal(manager.stoves.get('40f385712345').host, '10.0.0.7');
});

test('a command merges its answer and reads the stove again', async () => {
  const sent = [];
  const reads = [];
  const manager = createManager({
    scan: async () => [],
    getIntervalMs: () => 30000,
    onRead: async (entry) => reads.push(entry.stove.setpoint),
    onReachability: async () => {},
    onHostChanged: async () => {},
    clientFactory: fakeClients({ box: { stdt: GINGER_STDT, alls: GINGER_ALLS } }, sent),
    logger: silent,
  });
  manager.register('40f385712345', 'box');
  await manager.get('40f385712345', 1000);
  await manager.send('40f385712345', ['SET SETP 23']);
  assert.deepEqual(reads, [21, 23]);
  assert.ok(sent.includes('box SET SETP 23'));
  await assert.rejects(manager.send('unknown', ['CMD ON']), /Unknown stove/);
});
