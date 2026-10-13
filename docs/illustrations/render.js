// Renders integration widget contents the way the Gladys front does
// (front/src/components/boxs/external-widget: ExternalWidgetBox,
// WidgetComponents, widgetContentUtils), in plain DOM, with the same slots,
// order, class names and ApexCharts options. Only the components these
// widgets use: value tiles (inline or bound to a device feature), chart (live
// device features or inline series), status, buttons.
// Query: ?lang=fr&cards=stove,consumption&theme=dark
/* global ApexCharts, DATA */
const params = new URLSearchParams(location.search);
const LANG = params.get('lang') || 'en';
const CARDS = (params.get('cards') || 'stove').split(',');
const FEATURES = DATA.features[LANG];

const text = (value) =>
  value && typeof value === 'object' ? (value[LANG] ?? value.en ?? '') : (value ?? '');
// widgetContentUtils.formatNumber
const formatNumber = (value) =>
  typeof value === 'number'
    ? new Intl.NumberFormat(LANG, { maximumFractionDigits: 2 }).format(value)
    : text(value);
const COLOR = {
  neutral: 'colorNeutral',
  primary: 'colorPrimary',
  success: 'colorSuccess',
  warning: 'colorWarning',
  danger: 'colorDanger',
  info: 'colorInfo',
};
// deviceFeatureUnitShort of the Gladys front, for the units these features use.
const UNIT_SHORT = { celsius: '°C' };
const el = (tag, cls, children = []) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
};
const icon = (name, cls = '') => el('i', `fe fe-${name} ${cls}`);
// The core hands the front a selector for each external id it resolved.
const selectorOf = (c) => c.device_feature_selector || c.device_feature;
const selectorsOf = (c) => c.device_feature_selectors || c.device_features || [];

// widgetContentUtils.splitIntoSlots
function splitIntoSlots(components) {
  const slots = { header: [], tiles: [], focal: null, body: null, status: null, buttons: [] };
  for (const c of components) {
    if (c.type === 'text') c.variant === 'body' ? (slots.body = c) : slots.header.push(c);
    else if (c.type === 'value' || c.type === 'gauge') slots.tiles.push(c);
    else if (['chart', 'card-list', 'image'].includes(c.type)) slots.focal = c;
    else if (c.type === 'status') slots.status = c;
    else if (c.type === 'button') slots.buttons.push(c);
  }
  return slots;
}

const header = (components) =>
  el(
    'div',
    'header',
    components.map((c) => el('div', c.variant === 'heading' ? 'heading' : 'caption', text(c.text))),
  );

// TileValue: a device-bound tile shows DeviceFeatureValueText (value rounded
// to one decimal, not localized, plus the short unit); an inline tile shows
// the value the integration sent.
function tileValue(c) {
  const selector = selectorOf(c);
  if (selector) {
    const feature = FEATURES[selector];
    if (!feature) return el('span', 'tileValue', '…');
    const rounded = Math.round(feature.last_value * 10) / 10;
    return el(
      'span',
      'tileValue',
      el('span', null, [
        rounded,
        feature.unit ? el('span', null, ` ${UNIT_SHORT[feature.unit] || feature.unit}`) : null,
      ]),
    );
  }
  return el('span', `tileValue ${COLOR[c.color] || ''}`, [
    formatNumber(c.value),
    c.unit ? el('span', 'tileUnit', text(c.unit)) : null,
  ]);
}

const tiles = (components) =>
  el(
    'div',
    'tilesBox',
    el(
      'div',
      `tiles tilesCount${Math.min(components.length, 6)}`,
      components.map((c) => {
        const selector = selectorOf(c);
        const label = text(c.label) || (selector && FEATURES[selector]?.name) || '';
        return el('div', 'tile', [
          c.icon && c.type === 'value' ? icon(c.icon, `tileIcon ${COLOR[c.color] || ''}`) : null,
          tileValue(c),
          label ? el('span', 'tileLabel', label) : null,
        ]);
      }),
    ),
  );

// chart/yAxisFormatter.js
const yAxisFormatter = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return value;
  if (value === 0) return '0';
  const rounded = parseFloat(value.toPrecision(4));
  if (Math.abs(rounded) < 0.001 || Math.abs(rounded) >= 1e9) return rounded.toExponential(2);
  return value.toFixed(2);
};
const COLORS = [
  '#316cbe',
  '#d63031',
  '#00b894',
  '#fdcb6e',
  '#6c5ce7',
  '#00cec9',
  '#e84393',
  '#e17055',
  '#636e72',
];

// WidgetChart + ApexChartComponent (size small, display_axes): a content
// series is drawn as sent; live device features are the history the core
// returns (aggregated_states, at most 100 points), named after the feature.
function chart(component) {
  const box = el('div', null, [
    component.title ? el('div', 'caption mb-1', text(component.title)) : null,
  ]);
  const target = el('div', 'chart-sm');
  box.append(target);
  const series = component.series
    ? component.series.map((s, i) => ({
        name: text(s.name) || `${i + 1}`,
        data: s.points.map((p) => [new Date(p.t).getTime(), p.v]),
      }))
    : selectorsOf(component).map((selector, i) => ({
        name: FEATURES[selector]?.name || `${i + 1}`,
        data: (DATA.history[selector] || []).map((p) => [p.t, p.v]),
      }));
  const common = {
    dataLabels: { enabled: false },
    fill: { opacity: 1 },
    series,
    xaxis: {
      labels: { padding: 0, datetimeUTC: false },
      tooltip: { enabled: false },
      axisBorder: { show: false },
      type: 'datetime',
    },
    yaxis: { labels: { padding: 4, formatter: yAxisFormatter } },
    colors: COLORS,
    legend: { show: true, position: 'bottom' },
    annotations: { xaxis: [], points: [] },
  };
  const chartBase = {
    locales: window.APEX_LOCALES,
    defaultLocale: LANG,
    fontFamily: 'inherit',
    height: 200,
    parentHeightOffset: 0,
    sparkline: { enabled: false },
    toolbar: { show: false },
    animations: { enabled: false },
  };
  const options =
    component.chart_type === 'bar'
      ? {
          // ApexChartBarOptions
          ...common,
          chart: { ...chartBase, type: 'bar', stacked: true, zoom: { enabled: true } },
          plotOptions: { bar: { columnWidth: '90%' } },
          grid: {
            padding: { top: -20, right: 0, left: -4, bottom: -4 },
            strokeDashArray: 4,
            xaxis: { lines: { show: true } },
          },
        }
      : {
          // ApexChartLineOptions
          ...common,
          chart: { ...chartBase, type: 'line' },
          stroke: { width: 2, lineCap: 'round', curve: 'smooth' },
          grid: { strokeDashArray: 4, padding: { left: -4 } },
        };
  requestAnimationFrame(() => {
    window.PENDING_CHARTS += 1;
    new ApexCharts(target, options).render().then(() => {
      window.PENDING_CHARTS -= 1;
    });
  });
  return box;
}

const statusList = (component) =>
  el(
    'ul',
    'statusList',
    component.items.map((item) =>
      el('li', 'statusRow', [
        item.icon
          ? icon(item.icon, `statusIcon ${COLOR[item.color || 'neutral']}`)
          : el('span', `statusDot ${COLOR[item.color || 'neutral']}`),
        el('span', 'statusLabel', text(item.label)),
        el('span', 'statusValue', formatNumber(item.value)),
      ]),
    ),
  );

const buttons = (components) =>
  el(
    'div',
    'buttons',
    components.map((c) => {
      const node = el(
        'button',
        `button ${c.style === 'primary' ? 'buttonPrimary' : ''} ${c.style === 'danger' ? 'buttonDanger' : ''}`,
        [
          el('span', 'buttonIcon', icon(c.icon || 'play')),
          el('span', 'buttonLabel', text(c.label)),
        ],
      );
      node.type = 'button';
      return node;
    }),
  );

// ExternalWidgetBox: the title and icon of the card are the declaration of
// the widget in the manifest.
function card(name) {
  const content = DATA.contents[LANG][name];
  const { icon: cardIcon, label } = DATA.cards[name];
  const slots = splitIntoSlots(content.components);
  return el('div', 'card', [
    el(
      'div',
      'card-header',
      el('h3', 'card-title', [icon(cardIcon || 'grid'), el('span', 'm-1', text(label))]),
    ),
    el(
      'div',
      'card-body',
      el('div', 'slots', [
        slots.header.length ? header(slots.header) : null,
        slots.tiles.length ? tiles(slots.tiles) : null,
        slots.focal && slots.focal.type === 'chart' ? chart(slots.focal) : null,
        slots.body ? el('p', 'body', text(slots.body.text)) : null,
        slots.status ? statusList(slots.status) : null,
        slots.buttons.length ? buttons(slots.buttons) : null,
      ]),
    ),
  ]);
}

window.PENDING_CHARTS = 0;
const row = document.getElementById('row');
for (const name of CARDS) {
  row.append(el('div', 'col', card(name)));
}
setTimeout(() => {
  const wait = () => {
    if (window.PENDING_CHARTS === 0) document.body.dataset.ready = '1';
    else setTimeout(wait, 50);
  };
  wait();
}, 100);
