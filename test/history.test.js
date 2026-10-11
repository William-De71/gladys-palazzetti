import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHistoryStore, dailyBurn, dayOf, record } from '../src/history.js';

const at = (day, hour) => new Date(2026, 9, day, hour);

test('the kg of a day run from the end of the previous day', () => {
  const history = { days: {} };
  record(history, 1000, at(10, 20));
  record(history, 1012, at(10, 23));
  record(history, 1015, at(11, 8));
  record(history, 1030, at(11, 22));
  const burn = dailyBurn(history, at(11, 23), 3);
  assert.deepEqual(burn, [
    { day: '2026-10-09', kg: null },
    { day: '2026-10-10', kg: 12 },
    { day: '2026-10-11', kg: 18 },
  ]);
});

test('a small drop is a glitch, a big one a reset that keeps what was burnt', () => {
  const history = { days: {} };
  record(history, 1000, at(10, 8));
  assert.equal(record(history, 998, at(10, 9)), false);
  record(history, 1010, at(10, 12));
  record(history, 2, at(10, 13)); // counter reset at the service
  record(history, 7, at(10, 20));
  assert.equal(dailyBurn(history, at(10, 21), 1)[0].kg, 15);
});

test('the store keeps the history in its directory', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'palazzetti-'));
  try {
    const store = createHistoryStore({ dir, saveDelayMs: 10000 });
    await store.add('abc', 1000, at(10, 8));
    await store.add('abc', 1004, at(10, 9));
    await store.flush();
    const saved = JSON.parse(await readFile(path.join(dir, 'pellets-abc.json'), 'utf8'));
    assert.deepEqual(saved.days[dayOf(at(10, 8))], { first: 1000, last: 1004 });
    const again = createHistoryStore({ dir });
    assert.deepEqual((await again.get('abc')).days, saved.days);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
