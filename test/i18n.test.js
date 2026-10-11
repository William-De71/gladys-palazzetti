import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LANGUAGES,
  TEXTS,
  all,
  alarmLabel,
  fanLabel,
  formatTemperature,
  statusLabel,
  t,
} from '../src/i18n.js';

test('every text exists in the four languages of Gladys', () => {
  for (const [key, entry] of Object.entries(TEXTS)) {
    assert.deepEqual(Object.keys(entry).sort(), [...LANGUAGES].sort(), `${key}: languages`);
    for (const language of LANGUAGES) {
      assert.ok(entry[language].trim().length > 0, `${key}.${language} is empty`);
    }
  }
});

test('the placeholders are the same in every language', () => {
  for (const [key, entry] of Object.entries(TEXTS)) {
    const names = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    for (const language of LANGUAGES) {
      assert.deepEqual(names(entry[language]), names(entry.en), `${key}.${language}`);
    }
  }
});

test('the labels fall back on the code for what they do not know', () => {
  assert.equal(statusLabel(6, 'de'), 'Verbrennung');
  assert.equal(statusLabel(42, 'en'), 'Status 42');
  assert.equal(alarmLabel(253, 'es'), 'Sin pellets');
  assert.equal(alarmLabel(1000, 'fr'), 'Erreur 1000');
  assert.equal(fanLabel(3, 'fr'), 'Vitesse 3');
  assert.equal(formatTemperature(21.5, 'fr'), '21,5 °C');
  assert.equal(t('nope', 'fr'), 'nope');
  assert.deepEqual(Object.keys(all('fanAuto')), LANGUAGES);
});

test('index.js carries no inline message left out of i18n.js', () => {
  // An `fr:` key in index.js is a message that escaped the four-language table.
  const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bfr:\s*['"`]/);
});
