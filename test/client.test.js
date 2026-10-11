import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ERROR_KINDS,
  PalazzettiError,
  commandUrl,
  createClient,
  parseAnswer,
} from '../src/palazzetti/client.js';
import { envelope } from './helpers/fixtures.js';

test('a command travels in the cmd parameter, spaces encoded', () => {
  assert.equal(
    commandUrl('192.168.1.40', 'SET SETP 21'),
    'http://192.168.1.40/cgi-bin/sendmsg.lua?cmd=SET+SETP+21',
  );
});

test('a successful answer gives its DATA', () => {
  assert.deepEqual(parseAnswer(envelope({ SETP: 21 }), 'GET SETP'), { SETP: 21 });
});

test('the box answering for a silent stove is a stove timeout, not a success', () => {
  const body = JSON.stringify({
    INFO: { CMD: 'SET SETP 99', RSP: 'TIMEOUT', MSG: 'Stove communication failed' },
    SUCCESS: false,
    DATA: { NODATA: true },
  });
  assert.throws(() => parseAnswer(body, 'SET SETP 99'), {
    kind: ERROR_KINDS.STOVE_TIMEOUT,
  });
});

test('SUCCESS true with an RSP other than OK is still a refusal', () => {
  const body = JSON.stringify({ INFO: { RSP: 'ERROR' }, SUCCESS: true, DATA: {} });
  assert.throws(() => parseAnswer(body, 'SET POWR 9'), { kind: ERROR_KINDS.REFUSED });
});

test('something else than a box answer is invalid', () => {
  assert.throws(() => parseAnswer('<html>', 'GET ALLS'), { kind: ERROR_KINDS.INVALID });
  assert.throws(() => parseAnswer('{"hello":1}', 'GET ALLS'), { kind: ERROR_KINDS.INVALID });
});

test('the box never receives two requests at once', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const fetchImpl = async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight -= 1;
    return { ok: true, text: async () => envelope({ OK: 1 }) };
  };
  const box = createClient({ host: 'box', fetchImpl });
  await Promise.all([box.send('GET ALLS'), box.send('GET STDT'), box.send('SET SETP 20')]);
  assert.equal(maxInFlight, 1);
});

test('a failed command does not block the queue', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return calls === 1
      ? { ok: true, text: async () => '{"INFO":{"RSP":"ERROR"},"SUCCESS":false}' }
      : { ok: true, text: async () => envelope({ PWR: 2 }) };
  };
  const box = createClient({ host: 'box', fetchImpl, retries: 0 });
  await assert.rejects(box.send('SET POWR 9'), PalazzettiError);
  assert.deepEqual(await box.send('GET POWR'), { PWR: 2 });
});

test('an unreachable box is retried once, a refusal never', async () => {
  let calls = 0;
  const unreachable = async () => {
    calls += 1;
    throw Object.assign(new Error('fetch failed'), { cause: { code: 'EHOSTUNREACH' } });
  };
  const box = createClient({ host: 'box', fetchImpl: unreachable, retryDelayMs: 1 });
  await assert.rejects(box.send('GET ALLS'), { kind: ERROR_KINDS.UNREACHABLE });
  assert.equal(calls, 2);

  calls = 0;
  const refusing = async () => {
    calls += 1;
    return { ok: true, text: async () => '{"INFO":{"RSP":"ERROR"},"SUCCESS":false}' };
  };
  const other = createClient({ host: 'box', fetchImpl: refusing, retryDelayMs: 1 });
  await assert.rejects(other.send('SET POWR 9'), { kind: ERROR_KINDS.REFUSED });
  assert.equal(calls, 1);
});
