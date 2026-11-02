import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const clientSource = readFileSync(new URL('../docs/scripts/api_client.js', import.meta.url), 'utf8');
const serverSource = readFileSync(new URL('../server/event.js', import.meta.url), 'utf8');
const apiServerSource = readFileSync(new URL('../server/api_server.js', import.meta.url), 'utf8');
const eventsSource = readFileSync(new URL('../docs/scripts/events.js', import.meta.url), 'utf8');
const quietConsole = { log() {}, error() {} };

function createClient(overrides = {}) {
  const context = vm.createContext({
    CACHE: { getToken: () => 'token' },
    navigator: { onLine: true },
    console: quietConsole,
    API_URL: 'https://example.invalid',
    URLSearchParams,
    SyntaxError,
    TypeError,
    ...overrides,
  });
  vm.runInContext(clientSource, context);
  return vm.runInContext('API', context);
}

function checkSpreadsheet(openById) {
  const context = vm.createContext({
    CacheService: { getScriptCache: () => ({}) },
    PropertiesService: { getScriptProperties: () => ({}), getUserProperties: () => ({}) },
    SpreadsheetApp: { openById },
    console: quietConsole,
  });
  vm.runInContext(apiServerSource, context);
  vm.runInContext(serverSource, context);
  return vm.runInContext("checkFormAttendance_({ spreadsheetId: 'sheet-id' })", context);
}

test('inaccessible spreadsheets explain the server account permissions', async () => {
  const response = checkSpreadsheet(() => {
    throw new Error('You do not have permission to access the requested document.');
  });
  assert.equal(response.success, false);
  assert.match(response.error, /identificador/);
  assert.match(response.error, /compte de Google que executa el servidor/);
  assert.match(response.error, /permisos de lectura/);
  assert.equal(response.technicalDetails, 'Error: You do not have permission to access the requested document.');
  const client = createClient({
    fetch: async () => ({ ok: true, json: async () => response }),
  });
  await assert.rejects(client.checkFormAttendance({ spreadsheetId: 'sheet-id' }), error =>
    error.message === response.error && error.technicalDetails === response.technicalDetails);
});

test('invalid spreadsheet IDs show copying instructions even when validation is deferred', () => {
  const invalidIdError = new Error('Exception: Illegal spreadsheet id or key: 1212121');
  const fail = () => { throw invalidIdError; };
  for (const openById of [
    fail,
    () => ({ getSheets: fail }),
    () => ({ getSheets: () => [{ getDataRange: () => ({ getValues: fail }) }] }),
  ]) {
    const response = checkSpreadsheet(openById);
    assert.equal(response.success, false);
    assert.equal(response.status, 400);
    assert.match(response.error, /identificador.*no és vàlid/);
    assert.match(response.error, /entre \/d\/ i \/edit/);
    assert.doesNotMatch(response.error, /Exception|Illegal spreadsheet/);
    assert.equal(response.technicalDetails, invalidIdError.toString());
  }
});

test('embedded requests preserve spreadsheet errors', async () => {
  const response = checkSpreadsheet(() => { throw new Error('Document not found'); });
  const runner = {
    withSuccessHandler(handler) {
      this.successHandler = handler;
      return this;
    },
    withFailureHandler() {
      return this;
    },
    test() {
      this.successHandler(response);
    },
  };
  const client = createClient({ google: { script: { run: runner } } });
  await assert.rejects(client.checkFormAttendance({ spreadsheetId: 'sheet-id' }), error =>
    error.message === response.error && error.technicalDetails === response.technicalDetails);
});

test('invalid JSON rejects descriptively instead of resolving an error object', async () => {
  const client = createClient({
    fetch: async () => ({
      ok: true,
      json: async () => { throw new SyntaxError('Unexpected token <'); },
    }),
  });
  await assert.rejects(client.checkFormAttendance(), error => typeof error === 'string' && error.includes('resposta del servidor'));
});

test('network failures reject descriptively', async () => {
  const client = createClient({
    fetch: async () => { throw new TypeError('Failed to fetch'); },
  });
  await assert.rejects(client.checkFormAttendance(), error => typeof error === 'string' && error.includes('connectar a Internet'));
});

test('empty spreadsheets still return an empty result list', () => {
  const response = checkSpreadsheet(() => ({
    getSheets: () => [{ getDataRange: () => ({ getValues: () => [['Nom']] }) }],
  }));
  assert.equal(response.success, true);
  assert.equal(Array.isArray(response.result), true);
  assert.equal(response.result.length, 0);
});

test('successful API requests still resolve the attendance list', async () => {
  const matches = [{ formName: 'Maria', matched: true }];
  const client = createClient({
    fetch: async () => ({ ok: true, json: async () => ({ success: true, result: matches }) }),
  });
  assert.equal(await client.checkFormAttendance(), matches);
});

async function renderAttendance(request) {
  const btnText = { style: {} };
  const btnLoading = { style: {} };
  const submitBtn = {
    disabled: false,
    querySelector: selector => selector === '.btn-text' ? btnText : btnLoading,
  };
  const results = { style: {}, innerHTML: '' };
  const elements = {
    'check-attendance-sheet-input': { value: 'sheet-id' },
    'check-attendance-submit-btn': submitBtn,
    'check-attendance-results': results,
  };
  const context = vm.createContext({
    API: { checkFormAttendance: request },
    APP: { currentEventId: 'event-id' },
    window: {},
    document: {
      getElementById: id => elements[id],
      addEventListener() {},
    },
    escapeHtml: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    console: quietConsole,
  });
  vm.runInContext(eventsSource, context);
  vm.runInContext('EVENTS.checkFormAttendance()', context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(submitBtn.disabled, false);
  assert.equal(btnText.style.display, 'inline');
  assert.equal(btnLoading.style.display, 'none');
  assert.equal(results.style.display, 'block');
  return results.innerHTML;
}

test('attendance dialog safely displays the original error and restores the button', async () => {
  const html = await renderAttendance(() => Promise.reject('Comprova els permisos <sheet>'));
  assert.match(html, /check-attendance-error/);
  assert.match(html, /Comprova els permisos &lt;sheet&gt;/);
  assert.doesNotMatch(html, /TypeError/);
  assert.doesNotMatch(html, /<details/);
});

test('spreadsheet errors reach the dialog with collapsed and escaped technical details', async () => {
  const originalError = new Error('Exception: Illegal spreadsheet id or key: <script>alert(1)</script>');
  const response = checkSpreadsheet(() => { throw originalError; });
  const client = createClient({
    fetch: async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(response)) }),
  });
  const html = await renderAttendance(() => client.checkFormAttendance({ spreadsheetId: 'invalid' }));
  assert.match(html, /identificador.*no és vàlid/);
  assert.match(html, /<details class="check-attendance-error-details"><summary>Detalls tècnics<\/summary><pre>/);
  assert.match(html, /Error: Exception: Illegal spreadsheet id or key: &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>|<details[^>]*\bopen\b/);
});

test('legacy API errors keep their string rejection format', async () => {
  const client = createClient({
    fetch: async () => ({ ok: true, json: async () => ({ success: false, error: 'Legacy error' }) }),
  });
  await assert.rejects(client.checkFormAttendance(), error => error === 'Legacy error');
});

test('attendance dialog rejects malformed results descriptively', async () => {
  for (const result of [{ success: false }, null, undefined, 'invalid']) {
    const html = await renderAttendance(() => Promise.resolve(result));
    assert.match(html, /check-attendance-error/);
    assert.match(html, /llista de resultats/);
    assert.doesNotMatch(html, /TypeError/);
  }
});

test('attendance dialog still renders empty and populated results', async () => {
  const emptyHtml = await renderAttendance(() => Promise.resolve([]));
  assert.match(emptyHtml, /check-attendance-empty/);
  const matchesHtml = await renderAttendance(() => Promise.resolve([{ formName: 'Maria', matched: false }]));
  assert.match(matchesHtml, /Resultats \(1\)/);
  assert.match(matchesHtml, /Maria/);
});
