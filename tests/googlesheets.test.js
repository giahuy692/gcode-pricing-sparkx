const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const sync = require('../googlesheets');
const url = 'https://script.google.com/macros/s/test/exec';
beforeEach(() => {
  global.localStorage = { getItem: () => url };
});
test('accepts only deployment exec URLs', () => {
  assert.equal(sync.validateWebhookUrl(url), url);
  for (const value of ['https://docs.google.com/spreadsheets/d/123', url.replace('/exec', '/dev'), 'http://script.google.com/macros/s/a/exec']) {
    assert.throws(() => sync.validateWebhookUrl(value));
  }
});
test('confirms a real write using a CORS simple POST', async () => {
  global.fetch = async (target, options) => {
    assert.equal(options.mode, 'cors');
    assert.equal(options.headers['Content-Type'], 'text/plain;charset=utf-8');
    assert.equal(JSON.parse(options.body).filename, 'part.gcode');
    return { ok: true, json: async () => ({ status: 'success' }) };
  };
  assert.equal(await sync.syncOrder({ filename: 'part.gcode' }), true);
});
test('does not report opaque responses as saved', async () => {
  global.fetch = async () => ({ ok: false, status: 0, type: 'opaque' });
  await assert.rejects(sync.syncOrder({}), /HTTP 0/);
});
test('reports server write errors', async () => {
  global.fetch = async () => ({ ok: true, json: async () => ({ status: 'error', message: 'Permission denied' }) });
  await assert.rejects(sync.syncOrder({}), /Permission denied/);
});
test('rejects sign-in HTML and invalid JSON', async () => {
  global.fetch = async () => ({ ok: true, json: async () => { throw new Error('HTML'); } });
  const result = await sync.checkWebhookStatus();
  assert.equal(result.ok, false);
  assert.match(result.message, /JSON/);
});
test('network failure is not asserted to be a permissions diagnosis', async () => {
  global.fetch = async () => { throw new TypeError('Failed to fetch'); };
  const result = await sync.checkWebhookStatus();
  assert.equal(result.ok, false);
  assert.equal(result.needsAnyonePermission, undefined);
});
test('verifies CostMaster health response', async () => {
  global.fetch = async () => ({ ok: true, json: async () => ({ status: 'online', targetSheet: 'QuanLyGCodeIn3D' }) });
  assert.equal((await sync.checkWebhookStatus()).ok, true);
  global.fetch = async () => ({ ok: true, json: async () => ({ status: 'success' }) });
  assert.equal((await sync.checkWebhookStatus()).ok, false);
});
test('batch counts only acknowledged writes', async () => {
  let n = 0;
  global.fetch = async () => ({ ok: true, json: async () => ({ status: ++n === 1 ? 'success' : 'error' }) });
  assert.equal(await sync.syncBatch([{ filename: 'a' }, { filename: 'b' }]), 1);
});
test('Apps Script writes correct columns, flushes, releases lock and rejects bad input', () => {
  const rows = [];
  let released = 0, flushed = 0;
  const sheet = { getLastRow: () => rows.length, appendRow: row => rows.push(row), getRange: () => range, setFrozenRows() {} };
  const range = { setBackground() {}, setFontColor() {}, setFontWeight() {}, setHorizontalAlignment() {} };
  const ss = { getSheetByName: () => sheet, getName: () => 'Test' };
  const context = {
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() { released++; } }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush() { flushed++; } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
    Utilities: { formatDate: () => '30/10/2026' }
  };
  vm.createContext(context);
  vm.runInContext(sync.getAppsScriptTemplate(), context);
  assert.equal(JSON.parse(context.doGet({}).text).status, 'online');
  const result = context.doPost({ postData: { contents: JSON.stringify({ action: 'add_row', filename: 'part.gcode', costFilament: 123 }) } });
  assert.equal(JSON.parse(result.text).status, 'success');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].length, 23);
  assert.equal(rows[1].length, 23);
  assert.equal(rows[1][1], 'part.gcode');
  assert.equal(rows[1][8], 123);
  assert.equal(flushed, 1);
  assert.equal(released, 1);
  assert.equal(JSON.parse(context.doPost({}).text).status, 'error');
  assert.equal(rows.length, 2);
  assert.equal(released, 2);
});
