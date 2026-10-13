# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for Palazzetti pellet stoves: a
Node.js service (Node 22+, ESM, no build step) running in its own sandboxed
Docker container, talking to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js)
and to the stoves through the local HTTP API of the **Connection Box**
(`/cgi-bin/sendmsg.lua`, port 80). `type: "device"`, local only. Boxes are
found through the UDP probe Gladys broadcasts (`network_discovery`,
`udp-active-broadcast`, port 54549); the box pushes nothing, so each stove is
read on a loop, and the transitions between two reads become scene events.
Two dashboard widgets (`stove`, `consumption`), six scene triggers, two scene
actions.

## Commands

```bash
npm install
npm test                                  # node --test, never touches the network
node --test test/app.test.js              # one file
node --test --test-name-pattern "widget"  # tests whose name matches
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check
docs/illustrations/render.sh              # regenerates docs/assets/widgets.<lang>.png
```

## Architecture

```
index.js                      SDK wiring only: createApp(new GladysIntegration()) + connect
src/app.js                    every handler, registered before connect(); the tests drive
                              it with the fake Gladys of the SDK (test/app.test.js)
src/manager.js                known stoves, read loop, command queue, IP follow-up
src/device.js                 Gladys device and states of a stove, feature keys
src/commands.js               Gladys value -> box command, refusals explained
src/events.js                 read-to-read transitions -> scene events
src/scene-actions.js          get_status / control
src/widgets.js                stove and consumption widget contents (pure builders)
src/history.js                daily pellet history in /data
src/i18n.js                   every runtime text, en / fr / de / es
src/config.js                 config normalization, typed addresses, languages
src/palazzetti/client.js      HTTP client: one queue per box, envelope checks
src/palazzetti/discovery.js   UDP probe replies, stable stove id (MAC)
src/palazzetti/stove.js       capabilities and values of a stove (readStove)
src/palazzetti/constants.js   statuses, phases, alarms, fans
docs/illustrations/           render.sh + gen.mjs + render.js: generated widget images
.github/scripts/release.mjs   version, changelog, version files, PR title checks
```

## Rules

- **Forever fields**: device and feature external ids
  (`ext:<selector>:stove:<id>[:<feature>]`, `<id>` = the MAC of the box, the
  serial number without a valid MAC; feature keys in `FEATURE_KEYS`), and for
  each feature its `category`, `type`, `unit`, `min`, `max`; the device params
  `IP_ADDRESS` and `PALAZZETTI_ID`; the `config_schema` keys (`hosts`,
  `poll_interval`) and the settings action keys (`test_connection`,
  `sync_clock`); the widget keys (`stove`, `consumption`), their settings
  (`stove`, `show_chart`, `days`) and their button action keys; the scene
  trigger keys (`phase_changed`, `alarm_raised`, `alarm_cleared`,
  `pellets_low`, `connection_lost`, `connection_restored`), their fields and
  variables; the scene action keys (`get_status`, `control`), their fields and
  outputs. `test/structure.test.js` checks the discovery against
  `test/fixtures/discovery.baseline.json` and the manifest against
  `test/fixtures/manifest.baseline.json` (v1.0.1). A change needs an entry in
  its `ALLOWED_CHANGES` with the migration, in the changelog, the docs and the
  forum message: users would have to delete and recreate their devices,
  widgets or scenes.
- **One request at a time per box**: every call goes through the queue of
  `client.js`; overlapping requests make a Connection Box time out or crash.
  An answer is a success only when `SUCCESS` is true and `INFO.RSP` is `OK`.
  Commands are absolute values (retried once safely), never relative.
- **States**: only the ones that changed since the last publication
  (`publishStates` in `app.js`); a device created receives every state.
- **Scene events** on transitions between two reads only (`events.js`), flat
  scalar data limited to the declared variables, never caused by an action:
  a command or a scene action fires nothing by itself, the next read does.
  `connection_lost` after three reads without an answer, `connection_restored`
  only after a `connection_lost`.
- **Language**: Gladys does not send it with a command or a scene action; it is
  remembered from the last widget request (stored in the config through
  `setConfig`, `INTERNAL_KEYS.language`), and names the
  features, the status texts and the summaries. Every text Gladys shows comes
  from the manifest or `src/i18n.js`.
- **`/data` is the only writable place**: the daily pellet history
  (`/data/pellets-<id>.json`, written then renamed). The box addresses live
  in the device params, the language in the config.
- **User-facing text** exists in en, fr, de and es: manifest, `src/i18n.js`,
  `docs/*.md`, `README*.md`. `test/i18n.test.js` checks it. Images in
  `docs/*.md` use `raw.githubusercontent.com` URLs (the store re-hosts the
  docs), relative paths in the READMEs; the cover only in the READMEs.
- **Widget illustrations**: `docs/assets/widgets.<lang>.png` are generated from
  the widget code by `docs/illustrations/render.sh`: run it again after any
  change to a widget content, look at the four images, and keep them labelled
  as generated illustrations, not screenshots.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, `package-lock.json` or the manifest, nor the `docker_image`
  tag.
- **Changelog**: Ne jamais éditer CHANGELOG.md à la main, il est généré à la
  release. Écris le titre de PR comme la ligne que l'utilisateur lira.
- **Style**: Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network.
