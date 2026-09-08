const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../dashboard/index.html'), 'utf8');
function harness() {
  const elements = new Map();
  const calls = [], applied = [], pending = [];
  const context = vm.createContext({
    console: { log() {} },
    document: { getElementById(id) {
      if (!elements.has(id)) elements.set(id, { value: '02_ET', style: {}, classList: { add() {}, remove() {}, toggle() {} } });
      return elements.get(id);
    } },
    getUserEmail: () => 'test@gsaforce.com',
    applyData: data => applied.push(data),
    fetchWithTimeout: url => {
      calls.push(url);
      if (new URL(url).pathname === '/api/dashboard') {
        return new Promise(resolve => pending.push(data => resolve({ ok: true, json: async () => ({ kpis: {}, ...data }) })));
      }
      return Promise.resolve({ ok: true, json: async () => ({ rows: [] }) });
    },
  });
  vm.runInContext(`
    let DATE_COL = 'FlightDate', IS_805 = false, ALL_DATA = {}, DASHBOARD_ALLOWED_BIZ = null;
    const HAS_805_BIZ = new Set(['02_ET','03_UPS','04_ELAL','10_VIRGIN']);
    const API_BASE = 'https://example.test', DEMO = {};
    const BUSINESS_REQUESTS = new Map();
    let _isWarming = false;
  `, context);
  for (const name of ['getVariantBiz', 'getEffectiveBiz', 'canAccessEffectiveBusiness',
                      'canAccessBusinessOption', 'getBusinessData', 'loadData', 'showWeekDetail', 'showAwbDetail']) {
    const match = html.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`));
    assert.ok(match, `Missing function ${name}`);
    vm.runInContext(match[0], context);
  }
  return { context, calls, applied, pending, run: code => vm.runInContext(code, context) };
}

test('dashboard inline scripts parse', () => {
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([^]*?)<\/script>/g)) new vm.Script(match[1]);
});

test('ET dashboard offers only ET-USA with the combined toggle', () => {
  const h = harness();
  assert.equal(h.run('getEffectiveBiz()'), '02_ET');
  assert.equal(h.run('IS_805 = true; getEffectiveBiz()'), '02_ET_WITH_LGG');
  assert.equal(h.run("document.getElementById('bizSelect').value = '02_ET_LGG'; getEffectiveBiz()"), '02_ET_LGG');
  assert.doesNotMatch(html, /<option value="02_ET_LGG">/);
  assert.match(html, /<option value="02_ET">ET-USA<\/option>/);
});

test('combined view requires both business permissions', () => {
  const h = harness();
  h.run("DASHBOARD_ALLOWED_BIZ = new Set(['02_ET'])");
  assert.equal(h.run("canAccessEffectiveBusiness('02_ET_WITH_LGG')"), false);
  h.run("DASHBOARD_ALLOWED_BIZ.add('02_ET_LGG')");
  assert.equal(h.run("canAccessEffectiveBusiness('02_ET_WITH_LGG')"), true);
});

test('week and AWB detail requests preserve the toggle', async () => {
  const h = harness();
  h.run('IS_805 = true');
  await h.run('showWeekDetail(36, 2026)');
  await h.run("showAwbDetail('GSA_SName', 'ET-USA', 'ET-USA')");
  assert.equal(h.calls.length, 2);
  for (const url of h.calls) assert.equal(new URL(url).searchParams.get('biz'), '02_ET_WITH_LGG');
});

test('late pure response cannot overwrite selected W/LGG view', async () => {
  const h = harness();
  const pure = h.run('loadData()');
  h.run('IS_805 = true');
  const combined = h.run('loadData()');
  h.pending[1]({ scope: 'combined' });
  await combined;
  h.pending[0]({ scope: 'pure' });
  await pure;
  assert.deepEqual(h.applied.map(d => d.scope), ['combined']);
});

test('late flown response is cached under flown and cannot overwrite booked', async () => {
  const h = harness();
  const flown = h.run('loadData()');
  h.run("DATE_COL = 'Bkg_CreaDate'");
  const booked = h.run('loadData()');
  h.pending[1]({ scope: 'booked' });
  await booked;
  h.pending[0]({ scope: 'flown' });
  await flown;
  assert.deepEqual(h.applied.map(d => d.scope), ['booked']);
  assert.equal(h.run("ALL_DATA.FlightDate['02_ET'].scope"), 'flown');
  assert.equal(h.run("ALL_DATA.Bkg_CreaDate['02_ET'].scope"), 'booked');
});


test('prefetch and selection share a request; revisiting uses local cache', async () => {
  const h = harness();
  const prefetch = h.run("getBusinessData('02_ET', 'FlightDate')");
  const selected = h.run('loadData()');
  assert.equal(h.calls.length, 1);
  h.pending[0]({ scope: 'ET' });
  await Promise.all([prefetch, selected]);
  await h.run('loadData()');
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.applied.map(d => d.scope), ['ET', 'ET']);
});

test('warmup visits all allowed businesses sequentially without changing status', async () => {
  const h = harness();
  h.run("const ALL_BIZ_LIST = ['02_ET', '03_UPS', 'CXMEX']; DASHBOARD_ALLOWED_BIZ = new Set(['02_ET', '03_UPS']);");
  const match = html.match(/async function warmCache\([^]*?\n\}/);
  vm.runInContext(match[0], h.context);
  const warm = h.run('warmCache()');
  for (let i = 0; i < 4; i++) {
    assert.equal(h.calls.length, i + 1);
    h.pending[i]({});
    await new Promise(resolve => setImmediate(resolve));
  }
  await warm;
  assert.deepEqual(h.calls.map(url => new URL(url).searchParams.get('biz')), ['02_ET', '03_UPS', '02_ET', '03_UPS']);
  assert.equal(h.run("document.getElementById('connLabel').textContent"), undefined);
});
