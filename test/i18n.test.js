import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
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

const READMES = { en: 'README.md', fr: 'README.fr.md', de: 'README.de.md', es: 'README.es.md' };
const REPO_RAW = 'https://raw.githubusercontent.com/William-De71/gladys-palazzetti/main';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));
const manifest = JSON.parse(read('gladys-assistant-integration.json'));
// The headings and the table rows of a Markdown text: the four languages of a
// document must line up.
const shape = (text) => ({
  headings: text.match(/^#+ /gm).map((h) => h.trim()),
  tableRows: (text.match(/^\|/gm) ?? []).length,
});

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

test('the four docs exist, are long enough and share the same structure', () => {
  const reference = shape(read('docs/en.md'));
  for (const language of LANGUAGES) {
    assert.ok(exists(`docs/${language}.md`), `docs/${language}.md`);
    const text = read(`docs/${language}.md`);
    assert.ok(text.length > 300, `docs/${language}.md is too short`);
    assert.deepEqual(shape(text), reference, `docs/${language}.md structure`);
  }
});

test('the four READMEs exist, link to each other and share the same structure', () => {
  const reference = shape(read(READMES.en));
  for (const file of Object.values(READMES)) {
    const text = read(file);
    assert.deepEqual(shape(text), reference, `${file} structure`);
    for (const other of Object.values(READMES)) {
      if (other !== file) {
        assert.ok(text.includes(`(${other})`), `${file} links to ${other}`);
      }
    }
  }
});

test('every README shows the cover, the docs do not (the store already does)', () => {
  for (const language of LANGUAGES) {
    assert.ok(read(READMES[language]).includes('](cover.jpg)'), `${READMES[language]}: cover`);
    assert.ok(!read(`docs/${language}.md`).includes('cover.jpg'), `docs/${language}.md: no cover`);
  }
});

test('the docs show their images from the repository, as the store re-hosts them', () => {
  for (const language of LANGUAGES) {
    for (const [, target] of read(`docs/${language}.md`).matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) {
      assert.ok(target.startsWith(`${REPO_RAW}/`), `docs/${language}.md: ${target}`);
      assert.ok(exists(target.slice(REPO_RAW.length + 1)), `docs/${language}.md: ${target}`);
    }
  }
});

test('every relative link of the READMEs points to an existing file', () => {
  for (const file of Object.values(READMES)) {
    for (const [, target] of read(file).matchAll(/\]\(((?!https?:|#)[^)\s]+)\)/g)) {
      assert.ok(exists(target.split('#')[0]), `${file}: ${target}`);
    }
  }
});

test('every README carries the four badges, in order, under the language bar', () => {
  for (const file of Object.values(READMES)) {
    const text = read(file);
    assert.match(text.split('\n')[0], /README/, `${file}: language bar first`);
    const badges = [
      ...text.matchAll(/^\[!\[[^\]]+\]\((https:\/\/img\.shields\.io\/[^)]+)\)\]/gm),
    ].map(([, url]) => url);
    assert.equal(badges.length, 4, file);
    assert.match(badges[0], /badge\/(license|licence|Lizenz|licencia)-Apache--2\.0/, file);
    assert.match(
      badges[1],
      /github\/v\/release\/William-De71\/gladys-palazzetti\?sort=semver/,
      file,
    );
    assert.match(badges[2], /actions\/workflow\/status\/.*release\.yml/, file);
    assert.match(
      badges[3],
      new RegExp(`Gladys-%E2%89%A5%20${manifest.gladys_version.slice(2)}-`),
      file,
    );
  }
});

test('the generated widget illustration exists in every language and each page shows its own', () => {
  const image = (language) => `docs/assets/widgets.${language}.png`;
  for (const language of LANGUAGES) {
    assert.ok(exists(image(language)), image(language));
    assert.ok(
      read(READMES[language]).includes(`](${image(language)})`),
      `${READMES[language]}: ${image(language)}`,
    );
    assert.ok(
      read(`docs/${language}.md`).includes(`](${REPO_RAW}/${image(language)})`),
      `docs/${language}.md: ${image(language)}`,
    );
    for (const other of LANGUAGES.filter((l) => l !== language)) {
      assert.ok(!read(READMES[language]).includes(`widgets.${other}.png`), READMES[language]);
      assert.ok(!read(`docs/${language}.md`).includes(`widgets.${other}.png`), language);
    }
  }
});

test('the widget labels fit a dashboard card title in every language', () => {
  assert.equal(manifest.widgets.length, 2);
  for (const widget of manifest.widgets) {
    for (const language of LANGUAGES) {
      const { length } = widget.label[language];
      assert.ok(length >= 3 && length <= 30, `${widget.key}.${language}: ${length}`);
    }
  }
});
