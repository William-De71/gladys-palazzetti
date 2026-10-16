// -----------------------------------------------------------------------------
// The handlers of src/app.js, driven by the fake Gladys of the SDK: the real
// GladysIntegration with an in-memory Gladys, so the payloads are checked the
// way the core checks them. The Connection Box is a fake client; nothing
// touches the network, the pellet history goes to a temporary directory.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createApp } from '../src/app.js';
import { GINGER_ALLS, GINGER_CNTR, GINGER_STDT } from './helpers/fixtures.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const STOVE_ID = '40f385712345';
const DEVICE_ID = `ext:ext-palazzetti:stove:${STOVE_ID}`;

/**
 * A fake Connection Box at 192.168.1.40: a Ginger stove that records the
 * commands it receives.
 */
class FakeBox {
  constructor() {
    this.alls = { ...GINGER_ALLS };
    this.sent = [];
    this.down = false;
  }

  factory() {
    return ({ host }) => ({
      host,
      send: async (command) => {
        this.sent.push(command);
        if (this.down) {
          const error = new Error(`${host} unreachable`);
          error.kind = 'unreachable';
          throw error;
        }
        if (command === 'GET STDT') return GINGER_STDT;
        if (command === 'GET ALLS') return this.alls;
        if (command === 'GET CNTR') return GINGER_CNTR;
        if (command.startsWith('SET SETP')) {
          this.alls.SETP = Number(command.split(' ')[2]);
          return { SETP: this.alls.SETP };
        }
        return {};
      },
    });
  }
}

const settle = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A connected fake Gladys running the integration, its box found by the scan.
 * @param {object} t - The test context: the app stops when the test ends.
 * @param {object} [options] - `devices` the user created, `now` the clock.
 * @returns {Promise<object>} `{ gladys, box, app }`.
 */
async function start(t, { devices = [], now } = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'palazzetti-'));
  const gladys = createFakeGladys({
    selector: 'ext-palazzetti',
    devices,
    config: { poll_interval: 30 },
    scanResults: {
      'udp-active-broadcast': [
        {
          source_ip: '192.168.1.40',
          payload_base64: Buffer.from(
            JSON.stringify({ SUCCESS: true, DATA: GINGER_STDT }),
          ).toString('base64'),
        },
      ],
    },
  });
  const box = new FakeBox();
  const app = createApp(gladys, { clientFactory: box.factory(), dataDir, now });
  await gladys.connect();
  await settle();
  t.after(async () => {
    await app.shutdown();
    rmSync(dataDir, { recursive: true, force: true });
  });
  return { gladys, box, app };
}

/**
 * The device the discovery published, as the user would create it.
 * @param {object} gladys - The fake Gladys.
 * @returns {object} The created device.
 */
function createdDevice(gladys) {
  const [device] = gladys.fake.discoveredDevices;
  return { ...device, id: 'device-1', selector: 'palazzetti-salon' };
}

test('the stove found by the scan is offered on the Discovery screen', async (t) => {
  const { gladys } = await start(t);
  const [device] = gladys.fake.discoveredDevices;
  assert.equal(device.external_id, DEVICE_ID);
  assert.equal(device.name, 'Salon');
  assert.equal(gladys.fake.scans[0].port, 54549);
});

test('a device created by the user receives every state, and the widgets refresh', async (t) => {
  const { gladys } = await start(t);
  const device = createdDevice(gladys);
  gladys.fake.devices.push(device);
  await gladys.fake.deviceCreated(device);
  await settle();
  assert.equal(gladys.fake.lastState(`${DEVICE_ID}:setpoint`), GINGER_ALLS.SETP);
  assert.ok(gladys.fake.widgetRefreshes.includes('stove'), 'stove widget refreshed');
  assert.ok(gladys.fake.widgetRefreshes.includes('consumption'), 'consumption widget refreshed');
});

test('the setpoint is published again every 10 minutes, the other states on change only', async (t) => {
  let clock = Date.now();
  const { gladys, app } = await start(t, { now: () => clock });
  const device = createdDevice(gladys);
  gladys.fake.devices.push(device);
  await gladys.fake.deviceCreated(device);
  await settle();
  const count = (feature) =>
    gladys.fake.states.filter(
      (state) => state.device_feature_external_id === `${DEVICE_ID}:${feature}`,
    ).length;
  const before = { setpoint: count('setpoint'), power: count('power') };
  clock += 9 * 60 * 1000;
  await app.manager.round();
  assert.equal(count('setpoint'), before.setpoint, 'nothing before 10 minutes');
  clock += 60 * 1000;
  await app.manager.round();
  assert.equal(count('setpoint'), before.setpoint + 1);
  assert.equal(gladys.fake.lastState(`${DEVICE_ID}:setpoint`), GINGER_ALLS.SETP);
  assert.equal(count('power'), before.power, 'an unchanged power is not repeated');
});

test('a setpoint from Gladys reaches the box', async (t) => {
  const { gladys, box } = await start(t);
  const device = createdDevice(gladys);
  gladys.fake.devices.push(device);
  await gladys.fake.deviceCreated(device);
  const setpoint = device.features.find((feature) => feature.external_id.endsWith(':setpoint'));
  const ack = await gladys.fake.setValue(device, setpoint, 22);
  assert.equal(ack.success, true);
  assert.ok(box.sent.includes('SET SETP 22'), box.sent.join(', '));
});

test('both widgets answer a content the core accepts', async (t) => {
  const { gladys } = await start(t);
  const device = createdDevice(gladys);
  gladys.fake.devices.push(device);
  await gladys.fake.deviceCreated(device);
  for (const widget of manifest.widgets) {
    for (const language of ['en', 'fr', 'de', 'es']) {
      const ack = await gladys.fake.widgetGet(widget.key, {
        settings: { stove: DEVICE_ID },
        language,
      });
      assert.equal(ack.success, true, `${widget.key} ${language}: ${ack.error}`);
      assert.deepEqual(validateWidgetContent(ack.data.content), [], `${widget.key} ${language}`);
    }
  }
});

test('every scene action of the manifest is wired and returns its declared outputs only', async (t) => {
  const { gladys } = await start(t);
  const device = createdDevice(gladys);
  gladys.fake.devices.push(device);
  await gladys.fake.deviceCreated(device);
  const ack = await gladys.fake.sceneAction('get_status', { stove: DEVICE_ID });
  assert.equal(ack.success, true, ack.error);
  const declared = manifest.scene_actions
    .find((action) => action.key === 'get_status')
    .outputs.map((output) => output.key);
  for (const key of Object.keys(ack.data.outputs)) {
    assert.ok(declared.includes(key), `undeclared output ${key}`);
  }
  for (const action of manifest.scene_actions) {
    const result = await gladys.fake.sceneAction(action.key, { stove: DEVICE_ID });
    assert.doesNotMatch(String(result.error), /not implemented/, action.key);
  }
});

test('the configuration actions answer in the four languages', async (t) => {
  const { gladys } = await start(t);
  const ack = await gladys.fake.action('test_connection');
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(Object.keys(ack.data.message).sort(), ['de', 'en', 'es', 'fr']);
  assert.match(ack.data.message.fr, /Salon/);
});
