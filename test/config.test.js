import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  normalizeConfig,
  normalizeLanguage,
  parseHosts,
  readLanguage,
  readPollInterval,
} from '../src/config.js';

test('the defaults are the manifest ones', () => {
  assert.deepEqual(normalizeConfig(), { pollInterval: DEFAULT_CONFIG.poll_interval, hosts: [] });
});

test('the addresses are read whatever the user pasted', () => {
  assert.deepEqual(
    parseHosts('192.168.1.40, http://192.168.1.41/cgi-bin/sendmsg.lua\n192.168.1.40'),
    ['192.168.1.40', '192.168.1.41'],
  );
  assert.deepEqual(parseHosts('connbox.lan:8080; bad/url?'), ['connbox.lan:8080', 'bad']);
  assert.deepEqual(parseHosts(undefined), []);
});

test('the poll interval is bounded and forced to a number', () => {
  assert.equal(readPollInterval('45'), 45);
  assert.equal(readPollInterval('2'), 10);
  assert.equal(readPollInterval(9999), 300);
  assert.equal(readPollInterval('abc'), DEFAULT_CONFIG.poll_interval);
});

test('the languages fall back to English', () => {
  assert.equal(normalizeLanguage('de-AT'), 'de');
  assert.equal(normalizeLanguage('it'), 'en');
  assert.equal(readLanguage({ ui_language: 'es' }, 'en'), 'es');
  assert.equal(readLanguage({ ui_language: 'xx' }, 'fr'), 'fr');
});
