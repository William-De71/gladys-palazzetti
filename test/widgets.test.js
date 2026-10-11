import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { readStove } from '../src/palazzetti/stove.js';
import {
  WIDGET_ACTIONS,
  buildConsumptionWidget,
  buildStoveWidget,
  messageContent,
  nextPower,
  readDays,
} from '../src/widgets.js';
import { fakeGladys } from './helpers/fakeGladys.js';
import {
  GINGER_ALLS,
  GINGER_CNTR,
  GINGER_STDT,
  HYDRO_ALLS,
  HYDRO_STDT,
  JULIE_ALLS,
  JULIE_STDT,
  WOOD_ALLS,
  WOOD_STDT,
  withFields,
} from './helpers/fixtures.js';

const feature = fakeGladys().externalIds('stove', 'abc').feature;
const stoves = {
  ginger: readStove({ stdt: GINGER_STDT, alls: GINGER_ALLS, cntr: GINGER_CNTR }),
  julie: readStove({ stdt: JULIE_STDT, alls: JULIE_ALLS }),
  hydro: readStove({ stdt: HYDRO_STDT, alls: HYDRO_ALLS }),
  wood: readStove({ stdt: WOOD_STDT, alls: WOOD_ALLS }),
  alarm: readStove({ stdt: GINGER_STDT, alls: withFields(GINGER_ALLS, { LSTATUS: 1253 }) }),
  off: readStove({ stdt: GINGER_STDT, alls: withFields(GINGER_ALLS, { LSTATUS: 0 }) }),
};

test('every stove widget fits the vocabulary and the budget, in every language', () => {
  for (const [name, stove] of Object.entries(stoves)) {
    for (const language of ['en', 'fr', 'de', 'es']) {
      for (const showChart of [true, false]) {
        const content = buildStoveWidget({ stove, id: 'abc', feature, language, showChart });
        assert.deepEqual(validateWidgetContent(content), [], `${name}/${language}/${showChart}`);
      }
    }
  }
});

test('the buttons follow the state of the stove', () => {
  const actions = (stove) =>
    buildStoveWidget({ stove, id: 'abc', feature, language: 'en' })
      .components.filter((component) => component.type === 'button')
      .map((component) => component.action.key);
  assert.deepEqual(actions(stoves.ginger), [
    WIDGET_ACTIONS.TURN_OFF,
    WIDGET_ACTIONS.SETPOINT_DOWN,
    WIDGET_ACTIONS.SETPOINT_UP,
    WIDGET_ACTIONS.POWER_NEXT,
  ]);
  assert.equal(actions(stoves.off)[0], WIDGET_ACTIONS.TURN_ON);
  // No on/off button during an alarm, nor on a wood stove.
  assert.ok(!actions(stoves.alarm).includes(WIDGET_ACTIONS.TURN_ON));
  assert.deepEqual(actions(stoves.wood), []);
});

test('turning off asks for a confirmation, the buttons carry the stove and the value', () => {
  const buttons = buildStoveWidget({
    stove: stoves.ginger,
    id: 'abc',
    feature,
    language: 'fr',
  }).components.filter((component) => component.type === 'button');
  assert.equal(buttons[0].action.confirm, true);
  assert.deepEqual(buttons[1].action.params, { stove: 'abc', value: 20 });
  assert.deepEqual(buttons[3].action.params, { stove: 'abc', value: 4 });
  assert.equal(buttons[3].label, 'Puissance → 4');
});

test('the alarm shows in the status list, in red', () => {
  const status = buildStoveWidget({
    stove: stoves.alarm,
    id: 'abc',
    feature,
    language: 'fr',
  }).components.find((component) => component.type === 'status');
  assert.deepEqual(status.items[0], {
    label: 'État',
    value: 'Plus de pellets',
    icon: 'alert-triangle',
    color: 'danger',
  });
});

test('the power level cycles from 5 back to 1', () => {
  assert.equal(nextPower(3), 4);
  assert.equal(nextPower(5), 1);
  assert.equal(nextPower(null), 1);
});

test('the consumption widget: bars, today, per day, bags', () => {
  const daily = [
    { day: '2026-10-08', kg: null },
    { day: '2026-10-09', kg: 10 },
    { day: '2026-10-10', kg: 14 },
    { day: '2026-10-11', kg: 6 },
  ];
  for (const language of ['en', 'fr', 'de', 'es']) {
    const content = buildConsumptionWidget({ stove: stoves.ginger, daily, language });
    assert.deepEqual(validateWidgetContent(content), [], language);
  }
  const content = buildConsumptionWidget({ stove: stoves.ginger, daily, language: 'fr' });
  const [today, perDay, total] = content.components;
  assert.equal(today.value, 6);
  assert.equal(perDay.value, 12, 'the average leaves today out');
  assert.equal(total.value, 1807);
  const chart = content.components.find((component) => component.type === 'chart');
  assert.equal(chart.series[0].points.length, 3);
  const status = content.components.find((component) => component.type === 'status');
  assert.equal(status.items[0].value, '5,6'); // 12 kg/day × 7 / 15 kg
});

test('the consumption widget explains what it cannot show', () => {
  const noCounter = buildConsumptionWidget({ stove: stoves.hydro, daily: [], language: 'en' });
  assert.match(noCounter.components[0].text, /does not report/);
  const fresh = buildConsumptionWidget({
    stove: stoves.ginger,
    daily: [{ day: '2026-10-11', kg: 2 }],
    language: 'en',
  });
  assert.ok(fresh.components.some((component) => component.type === 'text'));
  assert.deepEqual(validateWidgetContent(fresh), []);
});

test('the days setting is bounded', () => {
  assert.equal(readDays({}), 14);
  assert.equal(readDays({ days: '30' }), 30);
  assert.equal(readDays({ days: 400 }), 60);
  assert.equal(readDays({ days: 1 }), 7);
});

test('a message content is valid', () => {
  assert.deepEqual(validateWidgetContent(messageContent('Hello')), []);
});
