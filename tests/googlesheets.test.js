const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sync = require('../googlesheets');
const url = 'https://script.google.com/macros/s/test/exec';
const token = 'test-token-12345678901234567890123456789';
const order = (id = 'ORD-1') => ({ id, filename: 'part.gcode', calculation: { costFilament: 123 } });
const health = () => ({ status: 'online', targetSheet: 'QuanLyGCodeIn3D',
  protocolVersion: 2, authRequired: true, spreadsheetId: sync.SPREADSHEET_ID });
let storage;
beforeEach(() => {
  storage = new Map([[sync.STORAGE_KEY, url], [sync.TOKEN_KEY, token]]);
  global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  sync.pendingSync = null;
});

function mockFetch(write = data => ({ status: 'success', orderId: data.orderId, spreadsheetId: sync.SPREADSHEET_ID })) {
  global.fetch = async (target, options) => ({
    ok: true, json: async () => options.method === 'POST' ? write(JSON.parse(options.body), options) : health()
  });
}

test('accepts only deployment exec URLs', () => {
  assert.equal(sync.validateWebhookUrl(url), url);
  for (const value of ['https://docs.google.com/spreadsheets/d/123', url.replace('/exec', '/dev'),
    'http://script.google.com/macros/s/a/exec', url + '?token=x', url + '#x']) {
    assert.throws(() => sync.validateWebhookUrl(value));
  }
});

test('auto sync defaults to enabled and preserves explicit opt out', () => {
  assert.equal(sync.isAutoSyncEnabled(), true);
  sync.setAutoSync(false);
  assert.equal(sync.isAutoSyncEnabled(), false);
});

test('confirms a real write using CORS simple POST, stable ID and private key', async () => {
  mockFetch((data, options) => {
    assert.equal(options.mode, 'cors');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.headers['Content-Type'], 'text/plain;charset=utf-8');
    assert.equal(data.filename, 'part.gcode');
    assert.equal(data.token, token);
    assert.equal(data.orderId, 'ORD-1');
    return { status: 'success', orderId: data.orderId, spreadsheetId: sync.SPREADSHEET_ID };
  });
  assert.equal(await sync.syncOrder(order()), true);
});

test('requires a saved ID and key before accessing the network', async () => {
  global.fetch = async () => assert.fail('must not fetch');
  await assert.rejects(sync.syncOrder({ filename: 'part' }), /thiếu mã/);
  sync.setToken('');
  await assert.rejects(sync.syncOrder(order()), /khóa ghi/);
});

test('does not report opaque responses as saved', async () => {
  global.fetch = async () => ({ ok: false, status: 0, type: 'opaque' });
  await assert.rejects(sync.syncOrder(order()), /HTTP 0/);
});

test('reports server write errors', async () => {
  mockFetch(() => ({ status: 'error', message: 'Permission denied' }));
  await assert.rejects(sync.syncOrder(order()), /Permission denied/);
});

test('rejects sign-in HTML and invalid JSON', async () => {
  global.fetch = async () => ({ ok: true, json: async () => { throw new Error('HTML'); } });
  assert.match((await sync.checkWebhookStatus()).message, /JSON/);
});

test('network failure is not asserted to be a permissions diagnosis', async () => {
  global.fetch = async () => { throw new TypeError('Failed to fetch'); };
  const result = await sync.checkWebhookStatus();
  assert.equal(result.ok, false);
  assert.equal(result.needsAnyonePermission, undefined);
});

test('refuses old or wrong-target webhooks before any write', async () => {
  for (const data of [{ status: 'online', targetSheet: 'QuanLyGCodeIn3D' },
    { ...health(), spreadsheetId: 'another-file' }, { ...health(), authRequired: false }]) {
    global.fetch = async (target, options) => {
      assert.notEqual(options.method, 'POST');
      return { ok: true, json: async () => data };
    };
    await assert.rejects(sync.syncOrder(order()), /đúng bản CostMaster/);
  }
});

test('requires acknowledgement of the exact order and spreadsheet', async () => {
  mockFetch(() => ({ status: 'success', orderId: 'ORD-other', spreadsheetId: sync.SPREADSHEET_ID }));
  await assert.rejects(sync.syncOrder(order()), /đúng mã đơn/);
});

test('queue survives reload and retries unacknowledged orders with the same ID', async () => {
  let orders = [order()];
  mockFetch(() => ({ status: 'error', message: 'offline' }));
  assert.equal(await sync.syncPendingOrders(orders), 0);
  assert.match(orders[0].googleSheetsSyncError, /offline/);
  assert.equal(orders[0].googleSheetsSyncedUrl, undefined);
  orders = JSON.parse(JSON.stringify(orders));
  mockFetch();
  assert.equal(await sync.syncPendingOrders(orders), 1);
  assert.equal(orders[0].id, 'ORD-1');
  assert.equal(orders[0].googleSheetsSyncedUrl, url);
  assert.equal(orders[0].googleSheetsSyncError, undefined);
  global.fetch = async () => assert.fail('already synced');
  assert.equal(await sync.syncPendingOrders(orders), 0);
});

test('queue respects opt out and missing configuration', async () => {
  global.fetch = async () => assert.fail('must not fetch');
  sync.setAutoSync(false);
  assert.equal(await sync.syncPendingOrders([order()]), 0);
  sync.setAutoSync(true);
  sync.setToken('');
  assert.equal(await sync.syncPendingOrders([order()]), 0);
});

test('overlapping queue triggers share a single in-flight write', async () => {
  let release, writes = 0, updates = 0;
  const gate = new Promise(resolve => { release = resolve; });
  mockFetch(async () => { writes++; await gate; return { status: 'success', orderId: 'ORD-1', spreadsheetId: sync.SPREADSHEET_ID }; });
  const orders = [order()];
  const first = sync.syncPendingOrders(orders, () => updates++);
  const second = sync.syncPendingOrders(orders);
  assert.equal(first, second);
  release();
  assert.equal(await first, 1);
  assert.equal(writes, 1);
  assert.equal(updates, 1);
});

test('batch counts only acknowledged writes and persists individual results', async () => {
  mockFetch(data => data.orderId === 'a'
    ? { status: 'success', orderId: 'a', spreadsheetId: sync.SPREADSHEET_ID }
    : { status: 'error', message: 'failed' });
  const orders = [order('a'), order('b')];
  assert.equal(await sync.syncBatch(orders), 1);
  assert.equal(orders[0].googleSheetsSyncedUrl, url);
  assert.equal(orders[1].googleSheetsSyncedUrl, undefined);
  assert.equal(orders[1].googleSheetsSyncError, 'failed');
});

test('copy button template exactly matches deployable Apps Script', () => {
  assert.equal(sync.getAppsScriptTemplate().trim(), fs.readFileSync(require.resolve('../google-apps-script/Code.gs'), 'utf8').trim());
});

function scriptHarness(initialRows = []) {
  const rows = initialRows.map(row => [...row]);
  const stats = { released: 0, flushed: 0, writes: 0, failFlush: false, failLock: false };
  const range = (rowNumber, column, height = 1, width = 1) => ({
    getValues: () => Array.from({ length: height }, (_, r) =>
      Array.from({ length: width }, (_, c) => rows[rowNumber - 1 + r]?.[column - 1 + c] ?? '')),
    setValues(values) {
      stats.writes++;
      values.forEach((row, r) => row.forEach((value, c) => {
        rows[rowNumber - 1 + r] ??= [];
        rows[rowNumber - 1 + r][column - 1 + c] = value;
      }));
      return this;
    },
    setValue(value) { return this.setValues([[value]]); },
    setBackground() { return this; }, setFontColor() { return this; }, setFontWeight() { return this; },
    createTextFinder(text) {
      return {
        matchEntireCell() { return this; }, matchCase() { return this; }, useRegularExpression() { return this; },
        findNext() {
          const idx = rows.findIndex((row, i) => i >= rowNumber - 1 && i < rowNumber - 1 + height && row[column - 1] === text);
          return idx < 0 ? null : { getRow: () => idx + 1 };
        }
      };
    }
  });
  const sheet = { getLastRow: () => rows.length, getRange: range, setFrozenRows() {} };
  const ss = { getId: () => sync.SPREADSHEET_ID, getUrl: () => 'https://docs.google.com/spreadsheets/d/' + sync.SPREADSHEET_ID,
    getSheetByName: name => { assert.equal(name, 'QuanLyGCodeIn3D'); return sheet; } };
  const context = {
    LockService: { getScriptLock: () => ({
      waitLock() { if (stats.failLock) throw new Error('lock timeout'); },
      releaseLock() { stats.released++; }
    }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: name => name === 'COSTMASTER_SYNC_TOKEN' ? token : null }) },
    SpreadsheetApp: {
      openById: id => { assert.equal(id, sync.SPREADSHEET_ID); return ss; },
      flush() { stats.flushed++; if (stats.failFlush) throw new Error('lost response'); }
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
    Utilities: { formatDate: () => '30/10/2026 15:00:00' }
  };
  vm.createContext(context);
  vm.runInContext(sync.getAppsScriptTemplate(), context);
  const post = (data = {}) => JSON.parse(context.doPost({ postData: { contents: JSON.stringify({
    action: 'add_row', orderId: 'ORD-1', spreadsheetId: sync.SPREADSHEET_ID, token, filename: 'part.gcode', ...data
  }) } }).text);
  return { rows, stats, context, post };
}

test('Apps Script writes all 24 columns to the exact spreadsheet and releases lock', () => {
  const { rows, stats, context, post } = scriptHarness();
  assert.deepEqual(JSON.parse(context.doGet().text), { ...health(), spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + sync.SPREADSHEET_ID });
  assert.equal(post({ costFilament: 123, costAccessories: 456, accessoriesDetail: 'LED' }).status, 'success');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].length, 24);
  assert.equal(rows[1].length, 24);
  assert.equal(rows[1][8], 123);
  assert.equal(rows[1][13], 456);
  assert.equal(rows[1][14], 'LED');
  assert.equal(rows[1][23], 'ORD-1');
  assert.equal(stats.flushed, 1);
  assert.equal(stats.released, 1);
});

test('Apps Script updates an existing ID instead of adding duplicates', () => {
  const { rows, post } = scriptHarness();
  post({ priceRetail: 100 });
  assert.equal(post({ priceRetail: 200 }).row, 2);
  assert.equal(rows.length, 2);
  assert.equal(rows[1][17], 200);
  post({ orderId: 'ORD-2' });
  assert.equal(rows.length, 3);
});

test('retry after a persisted write loses its response does not add a row', () => {
  const { rows, stats, post } = scriptHarness();
  stats.failFlush = true;
  assert.equal(post().status, 'error');
  stats.failFlush = false;
  assert.equal(post().status, 'success');
  assert.equal(rows.length, 2);
});

test('Apps Script rejects unauthorized and malformed input before writing', () => {
  const { rows, post, context } = scriptHarness();
  for (const data of [{ token: '' }, { token: 'wrong' }, { spreadsheetId: 'other' },
    { orderId: '=x' }, { filename: '' }, { filename: {} }, { weightGrams: -1 },
    { priceRetail: '100' }, { notes: {} }]) {
    assert.equal(post(data).status, 'error');
    assert.equal(rows.length, 0);
  }
  assert.equal(JSON.parse(context.doPost({}).text).status, 'error');
});

test('Apps Script stores formula-looking text as text, with negative profit supported', () => {
  const { rows, post } = scriptHarness();
  assert.equal(post({ filename: '=IMPORTXML("bad")', notes: '  +1', netProfitRetail: -10 }).status, 'success');
  assert.equal(rows[1][1], '\'=IMPORTXML("bad")');
  assert.equal(rows[1][22], "'  +1");
  assert.equal(rows[1][18], -10);
});

test('preserves existing 23-column rows and adds only the ID column', () => {
  const first = scriptHarness();
  first.post();
  const headers = first.rows[0].slice(0, 23);
  const legacyRow = first.rows[1].slice(0, 23);
  const { rows, post } = scriptHarness([headers, legacyRow]);
  assert.equal(post().status, 'success');
  assert.deepEqual(rows[1], legacyRow);
  assert.equal(rows[0][23], 'Mã Đơn Hàng');
  assert.equal(rows.length, 3);
});

test('refuses to overwrite unknown headers or an occupied ID column', () => {
  const first = scriptHarness();
  first.post();
  for (const headers of [Array(24).fill('Other'), [...first.rows[0].slice(0, 23), 'Already used']]) {
    const { rows, post, stats } = scriptHarness([headers]);
    assert.equal(post().status, 'error');
    assert.equal(rows.length, 1);
    assert.equal(stats.writes, 0);
  }
});

test('does not release a lock it failed to acquire', () => {
  const { stats, post, rows } = scriptHarness();
  stats.failLock = true;
  assert.equal(post().status, 'error');
  assert.equal(stats.released, 0);
  assert.equal(rows.length, 0);
});
