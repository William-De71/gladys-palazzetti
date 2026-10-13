// -----------------------------------------------------------------------------
// Entry point of the Palazzetti external integration.
//
// Palazzetti pellet stoves equipped with a Connection Box answer a local HTTP
// API (`/cgi-bin/sendmsg.lua`): no cloud, no account. Every handler lives in
// src/app.js (devices, widgets, scene triggers and actions, configuration
// actions); this file builds the SDK instance, registers them BEFORE
// connect(), then connects.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
//   TZ (the time zone of Gladys: local days of the history, stove clock)
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
const app = createApp(gladys);

// --- Graceful shutdown -------------------------------------------------------
gladys.handleShutdown(async (signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
  await app.shutdown();
});

// --- Startup -----------------------------------------------------------------
logger.info(`Starting the Palazzetti integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
