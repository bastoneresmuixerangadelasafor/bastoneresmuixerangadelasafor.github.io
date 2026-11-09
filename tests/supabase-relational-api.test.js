import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const apiDirectory = fileURLToPath(new URL('../supabase/functions/api/', import.meta.url));

function loadModule(filename, globals, client, cache) {
  const resolvedFilename = resolve(filename);
  if (cache.has(resolvedFilename)) return cache.get(resolvedFilename);
  const module = { exports: {} };
  cache.set(resolvedFilename, module.exports);
  const source = readFileSync(resolvedFilename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = specifier => {
    if (specifier.startsWith('npm:')) return { createClient: () => client };
    return loadModule(resolve(dirname(resolvedFilename), specifier), globals, client, cache);
  };
  vm.runInNewContext(compiled, { ...globals, exports: module.exports, module, require: localRequire });
  return module.exports;
}

function createApi() {
  const tables = {
    members: [{ id: '1', email: 'alice@example.invalid', alias: 'Alice',
      name: 'Alice', type: 'ADULT', roles: ['ADMIN'], active: true }],
    member_relations: [], events: [], event_diagrams: [], trainings: [], event_attendance: [], training_attendance: [],
    dances: [], member_dances: [], member_positions: [], push_tokens: [], data_versions: [],
  };
  const keys = {
    events: ['id'], trainings: ['id'], event_attendance: ['event_id', 'member_id'],
    training_attendance: ['training_id', 'member_id'], data_versions: ['name'],
  };
  function from(name) {
    const filter = [];
    let operation = 'select';
    let values;
    let selection = '';
    const orders = [];
    let bounds;
    const query = {
      select(value) { selection = value; return this; },
      eq(key, value) { filter.push(row => row[key] === value); return this; },
      ilike(key, value) { filter.push(row => String(row[key] || '').toLowerCase() === String(value).toLowerCase()); return this; },
      in(key, value) { filter.push(row => value.includes(row[key])); return this; },
      lt(key, value) { filter.push(row => row[key] < value); return this; },
      order(key) { orders.push(key); return this; },
      range(start, end) { bounds = [start, end]; return this; },
      limit() { return this; },
      upsert(value) { operation = 'upsert'; values = value; return this; },
      update(value) { operation = 'update'; values = value; return this; },
      delete() { operation = 'delete'; return this; },
      async execute() {
        let rows = tables[name].filter(row => filter.every(fn => fn(row)));
        if (orders.length) rows.sort((a, b) => {
          for (const key of orders) {
            if (a[key] < b[key]) return -1;
            if (a[key] > b[key]) return 1;
          }
          return 0;
        });
        if (operation === 'select' && bounds) rows = rows.slice(bounds[0], bounds[1] + 1);
        if (operation === 'upsert') {
          const columns = keys[name] || ['id'];
          const old = tables[name].find(row => columns.every(key => row[key] === values[key]));
          if (old) Object.assign(old, values);
          else tables[name].push({ ...values });
          rows = [old || tables[name].at(-1)];
        } else if (operation === 'update') {
          rows.forEach(row => Object.assign(row, values));
        } else if (operation === 'delete') {
          tables[name] = tables[name].filter(row => !rows.includes(row));
        }
        if (selection.includes('members!inner')) {
          rows = rows.map(row => ({ ...row, members: { alias: tables.members.find(member => member.id === row.member_id).alias } }));
        }
        if (selection.includes('dances!inner')) {
          rows = rows.map(row => ({ ...row, dances: { name: tables.dances.find(dance => dance.id === row.dance_id).name } }));
        }
        return { data: rows, error: null };
      },
      async maybeSingle() { const result = await this.execute(); return { ...result, data: result.data[0] || null }; },
      then(resolve, reject) { return this.execute().then(resolve, reject); },
    };
    return query;
  }
  const client = {
    from,
    async rpc(name, args) {
      if (name === 'save_member_position') {
        let dance = tables.dances.find(item => item.name === args.p_dance_name);
        if (!dance) {
          dance = { id: webcrypto.randomUUID(), name: args.p_dance_name };
          tables.dances.push(dance);
        }
        if (!tables.member_dances.some(item => item.member_id === args.p_member_id && item.dance_id === dance.id)) {
          tables.member_dances.push({ member_id: args.p_member_id, dance_id: dance.id });
        }
        let position = tables.member_positions.find(item => item.member_id === args.p_member_id &&
          item.dance_id === dance.id && item.position_order === args.p_position_order);
        if (!position) {
          position = { member_id: args.p_member_id, dance_id: dance.id, position_order: args.p_position_order };
          tables.member_positions.push(position);
        }
        position.status = args.p_value;
        return { error: null };
      }
      if (name === 'save_member') {
        const member = args.p_member;
        const row = { ...member };
        delete row.relations;
        const index = tables.members.findIndex(item => item.id === member.id);
        if (index < 0) tables.members.push(row);
        else tables.members[index] = row;
        tables.member_relations = tables.member_relations.filter(item => item.member_id !== member.id);
        (member.relations || []).forEach((related, index) => tables.member_relations.push({
          member_id: member.id, related_member_id: related, position: index + 1,
        }));
        return { error: null };
      }
      if (name !== 'save_event') throw new Error(`Unexpected RPC: ${name}`);
      const event = args.p_event;
      let row = tables.events.find(item => item.id === args.p_id);
      if (!row) {
        row = { id: args.p_id, confirmed: false, visible: false };
        tables.events.push(row);
      }
      row.name = event.name;
      if (event.datetime || event.date) row.event_date = row.event_datetime = event.datetime || event.date;
      for (const [source, target] of Object.entries({
        meetingPlace: 'meeting_place', placeUrl: 'place_url', attendanceListId: 'attendance_list_id',
        confirmed: 'confirmed', visible: 'visible',
      })) if (event[source] !== undefined) row[target] = event[source];
      if (event.diagrams !== undefined) {
        tables.event_diagrams = tables.event_diagrams.filter(item => item.event_id !== row.id);
        event.diagrams.forEach((diagram, index) => tables.event_diagrams.push({
          event_id: row.id, position: index + 1, diagram_data: diagram,
        }));
      }
      return { error: null };
    },
    auth: {
      getUser: async () => ({ data: { user: { email: 'alice@example.invalid' } }, error: null }),
      signInWithPassword: async () => ({ data: {
        user: { email: 'alice@example.invalid' }, session: { access_token: 'token', refresh_token: 'refresh' },
      }, error: null }),
    },
  };
  let handler;
  const context = {
    Deno: { env: { get: name => name }, serve: value => { handler = value; } },
    crypto: webcrypto, Request, Response, URLSearchParams, TextEncoder, console, btoa,
  };
  loadModule(resolve(apiDirectory, 'index.ts'), context, client, new Map());
  return {
    tables,
    async request(action, body = {}, parameters = {}) {
      const request = new Request('https://example.invalid', {
        method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, body, parameters }),
      });
      return (await handler(request)).json();
    },
  };
}

test('event renames retain the event UUID and its attendance uses member IDs', async () => {
  const api = createApi();
  const created = await api.request('saveEvent', { event: { name: 'First', datetime: '2026-01-01T10:00' } });
  assert.equal(created.success, true);
  const id = created.result.sheetName;
  const renamed = await api.request('saveEvent', { event: { id, name: 'Renamed', datetime: '2026-01-01T10:00' } });
  assert.equal(renamed.result.sheetName, id);
  assert.equal(api.tables.events.length, 1);
  const response = await api.request('confirmEventMemberAttendance', { eventId: id, memberAlias: 'Alice', attending: true });
  assert.equal(response.success, true);
  assert.equal(api.tables.event_attendance[0].event_id, id);
  assert.equal(api.tables.event_attendance[0].member_id, '1');
  assert.ok(api.tables.data_versions.some(row => row.name === 'events'));
});

test('member columns support profiles, admin access and inactive accounts', async () => {
  const api = createApi();
  api.tables.members.push({ id: '2', email: null, alias: 'Bob', name: 'Robert', type: 'KID', roles: [], active: true });
  api.tables.member_relations.push({ member_id: '1', related_member_id: '2', position: 1 });
  const result = await api.request('members');
  assert.equal(result.success, true);
  assert.equal(result.result[0].name, 'Alice');
  assert.deepEqual(result.result[0].roles, ['ADMIN']);
  assert.deepEqual(result.result[0].relations, ['2']);
  assert.equal(result.result[0].relatedMembers[0].name, 'Robert');
  assert.equal(result.result[1].email, '');
  const user = await api.request('user');
  assert.equal(user.result.user.displayName, 'Alice');
  const login = await api.request('login', { email: 'alice@example.invalid', password: 'password' });
  assert.equal(login.success, true);
  assert.deepEqual(login.result.user.relations, ['2']);
  const saved = await api.request('saveMember', { member: {
    id: '2', alias: 'Bobby', fullName: 'Robert', type: 'KID', active: true,
  } });
  assert.equal(saved.success, true);
  assert.equal(api.tables.members[1].alias, 'Bobby');
  assert.equal(api.tables.members[1].roles.length, 0);
  const training = await api.request('saveTraining', { training: { date: '2026-01-01T10:00' } });
  api.tables.members[0].roles = [];
  const related = await api.request('confirmRelatedMemberAttendance', {
    trainingId: training.result.trainingId, memberId: '2', memberAlias: 'Bobby',
  });
  assert.equal(related.success, true);
  assert.equal(api.tables.training_attendance[0].member_id, '2');
  api.tables.members[0].active = false;
  assert.equal((await api.request('members')).status, 403);
});

test('normalized member positions retain API shape, empty dances and independent updates', async () => {
  const api = createApi();
  api.tables.dances.push({ id: 'empty', name: 'Empty' });
  api.tables.member_dances.push({ member_id: '1', dance_id: 'empty' });
  for (const [positionOrder, value] of [[1, 'si'], [2, 'no'], [1, 'en progres']]) {
    const updated = await api.request('updateMemberPosition', { memberAlias: 'Alice', danceName: 'Dance', positionOrder, value });
    assert.equal(updated.success, true);
  }
  const response = await api.request('memberPositions', {}, { memberAlias: 'Alice' });
  assert.deepEqual(response.result, { Empty: {}, Dance: { 1: 'EN PROGRES', 2: 'NO' } });
  assert.equal(api.tables.member_positions.length, 2);
  assert.equal((await api.request('updateMemberPosition', {
    memberAlias: 'Alice', danceName: 'Dance', positionOrder: '01', value: 'YES',
  })).success, false);
  assert.equal((await api.request('updateMemberPosition', {
    memberAlias: 'Alice', danceName: 'Dance', positionOrder: 1, value: 'MAYBE',
  })).success, false);
  const danceId = api.tables.dances.find(dance => dance.name === 'Dance').id;
  for (let order = 3; order <= 1100; order++) {
    api.tables.member_positions.push({ member_id: '1', dance_id: danceId, position_order: order, status: 'known' });
  }
  const paged = await api.request('memberPositions', {}, { memberAlias: 'Alice' });
  assert.equal(Object.keys(paged.result.Dance).length, 1100);
  assert.equal(paged.result.Dance['1100'], 'SI');
});

test('event columns and diagrams round-trip while edits preserve omitted fields', async () => {
  const api = createApi();
  const diagram = { danceName: 'Dance', positions: [{ order: 1, tag: 'A' }], groups: [['Alice']], backup: [] };
  const created = await api.request('saveEvent', { event: {
    name: 'First', datetime: '2020-01-01T10:00', meetingPlace: 'Square', placeUrl: 'https://example.invalid',
    attendanceListId: 'sheet', confirmed: true, visible: true, diagrams: [diagram],
  } });
  const id = created.result.sheetName;
  await api.request('saveEvent', { event: { id, name: 'Renamed' } });
  const detail = await api.request('event', {}, { eventId: id });
  assert.equal(detail.result.meetingPlace, 'Square');
  assert.equal(detail.result.attendanceListId, 'sheet');
  assert.deepEqual(JSON.parse(JSON.stringify(detail.result.diagrams)), [diagram]);
  assert.equal(api.tables.events[0].event_data, undefined);
  const list = await api.request('events');
  assert.equal(list.result[0].placeUrl, 'https://example.invalid');
  await api.request('setEventVisibility', { eventName: 'Renamed', visible: false });
  assert.equal(api.tables.events[0].visible, false);
  const counts = await api.request('calculateEventDancePositions', {}, { danceName: 'Dance' });
  assert.equal(counts.result['1'].members[0].count, 1);
});

test('training date edits retain the UUID and attendance references', async () => {
  const api = createApi();
  const created = await api.request('saveTraining', { training: { date: '2026-01-01T10:00', description: 'Line one\nLine two' } });
  assert.equal(created.success, true);
  const id = created.result.trainingId;
  const confirmed = await api.request('confirmTrainingAttendance', { trainingId: id });
  assert.equal(confirmed.success, true);
  const edited = await api.request('saveTraining', { training: { id, date: '2026-01-01T10:00', newDate: '2026-02-01T10:00' } });
  assert.equal(edited.result.trainingId, id);
  assert.equal(api.tables.trainings.length, 1);
  assert.equal(api.tables.trainings[0].training_date, '2026-02-01T10:00');
  assert.equal(api.tables.trainings[0].description, 'Line one\nLine two');
  assert.equal(api.tables.trainings[0].training_data, undefined);
  const detail = await api.request('training', {}, { trainingId: id });
  assert.equal(detail.result.description, 'Line one\nLine two');
  const list = await api.request('trainings');
  assert.equal(list.result[0].description, 'Line one\nLine two');
  const changed = await api.request('saveTraining', { training: { id, date: '2026-02-01T10:00', description: '' } });
  assert.equal(changed.success, true);
  assert.equal(api.tables.trainings[0].description, '');
  const invalid = await api.request('saveTraining', { training: { id, date: '2026-02-01T10:00', unexpected: 'x' } });
  assert.equal(invalid.success, false);
  assert.equal(api.tables.training_attendance[0].training_id, id);
  assert.equal(api.tables.training_attendance[0].member_id, '1');
});

test('attendance booleans preserve note-only, confirmed and rejected states', async () => {
  const api = createApi();
  const created = await api.request('saveTraining', { training: { date: '2026-01-01T10:00' } });
  const id = created.result.trainingId;
  await api.request('saveTrainingNote', { trainingId: id, note: 'note' });
  assert.equal(api.tables.training_attendance[0].attending, null);
  let detail = await api.request('training', {}, { trainingId: id });
  assert.deepEqual(detail.result.attendees, []);
  assert.deepEqual(detail.result.rejections, []);
  assert.equal(detail.result.notes.Alice, 'note');
  await api.request('confirmTrainingAttendance', { trainingId: id });
  assert.equal(api.tables.training_attendance[0].attending, true);
  await api.request('cancelTrainingAttendance', { trainingId: id });
  assert.equal(api.tables.training_attendance[0].attending, false);
  detail = await api.request('training', {}, { trainingId: id });
  assert.deepEqual(detail.result.rejections, ['Alice']);
  assert.equal(detail.result.notes.Alice, 'note');
});
