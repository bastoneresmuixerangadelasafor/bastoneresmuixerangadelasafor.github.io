import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const baseline = await readFile(new URL('../supabase/migrations/202611070001_initial_schema.sql', import.meta.url), 'utf8');

async function database() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.role() returns text language sql as
      $$select current_setting('request.jwt.claim.role', true)$$;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean);
    select set_config('request.jwt.claim.role', 'service_role', false);
  `);
  return db;
}

const payload = {
  members: [{ id: '1', alias: 'Alice', name: 'Alice Smith', type: 'ADULT', active: false, roles: ['ADMIN', 'OTHER'], email: 'alice@example.invalid', relations: ['2'] }, { id: '2', alias: 'Bob' }],
  events: [{ id: 'Old event', name: 'Old event', date: '2026-01-01T10:00',
    meetingPlace: 'Square', placeUrl: 'https://example.invalid', confirmed: true, visible: true,
    detail: { datetime: '2026-01-01T11:00', attendanceListId: 'sheet', diagrams: [{ danceName: 'Dance', positions: [{ order: 1 }],
      groups: [['Alice', null]], backup: ['Bob'] }], attendees: ['Alice'], rejections: ['Bob'], notes: { Alice: 'event note' } } }],
  trainings: [{ id: '2026-01-02T10:00', date: '2026-01-02T10:00',
    description: 'First line\nSecond line', attendees: ['Bob'], notes: { Bob: 'training note' } }],
  memberPositions: { Alice: { Dance: { 0: '', 1: 'SI', 2: 'NO', 3: 'EN PROGRES' }, Empty: {} } },
  pushTokens: { 'alice@example.invalid': ['token'] },
  dataVersions: { events: 1 },
};

test('fresh import stores UUID entity IDs and foreign-keyed member relationships', async () => {
  const db = await database();
  try {
    await db.exec(baseline);
    await db.query('select public.import_legacy_data($1::jsonb)', [JSON.stringify(payload)]);
    const result = await db.query(`
      select e.id::text, e.legacy_id, a.member_id, a.note, m.alias
      from public.events e join public.event_attendance a on a.event_id=e.id
      join public.members m on m.id=a.member_id where a.attending=true
    `);
    assert.match(result.rows[0].id, /^[0-9a-f-]{36}$/);
    assert.equal(result.rows[0].legacy_id, 'Old event');
    assert.equal(result.rows[0].member_id, '1');
    assert.equal(result.rows[0].alias, 'Alice');
    assert.equal(result.rows[0].note, 'event note');
    const member = await db.query("select name, type, roles, active from public.members where id='1'");
    assert.deepEqual(member.rows[0], { name: 'Alice Smith', type: 'ADULT', roles: ['ADMIN', 'OTHER'], active: false });
    const training = await db.query('select description from public.trainings');
    assert.equal(training.rows[0].description, 'First line\nSecond line');
    const positions = await db.query('select position_order, status from public.member_positions order by position_order');
    assert.deepEqual(positions.rows, [{ position_order: 0, status: null }, { position_order: 1, status: 'known' }, { position_order: 2, status: 'not_known' }, { position_order: 3, status: 'learning' }]);
    const memberDances = await db.query('select count(*)::int as count from public.member_dances');
    assert.equal(memberDances.rows[0].count, 2);
    await db.query("select public.save_member_position('1', 'Dance', 2, 'known')");
    const updatedPosition = await db.query('select status from public.member_positions where position_order=2');
    assert.equal(updatedPosition.rows[0].status, 'known');
    await assert.rejects(db.query("select public.save_member_position('missing', 'New dance', 1, 'known')"));
    await assert.rejects(db.query("select public.save_member_position('1', 'Dance', 1, 'invalid')"));
    const failedDance = await db.query("select count(*)::int as count from public.dances where name='New dance'");
    assert.equal(failedDance.rows[0].count, 0);
    const event = await db.query('select event_date, event_datetime, meeting_place, place_url, attendance_list_id, confirmed, visible from public.events');
    assert.deepEqual(event.rows[0], { event_date: '2026-01-01T10:00', event_datetime: '2026-01-01T11:00', meeting_place: 'Square', place_url: 'https://example.invalid',
      attendance_list_id: 'sheet', confirmed: true, visible: true });
    const diagram = await db.query('select diagram_data from public.event_diagrams');
    assert.deepEqual(diagram.rows[0].diagram_data, payload.events[0].detail.diagrams[0]);
    await db.query('select public.save_event($1::uuid, $2::jsonb)', [result.rows[0].id, JSON.stringify({ name: 'Changed' })]);
    const preservedEvent = await db.query('select meeting_place, visible from public.events');
    assert.deepEqual(preservedEvent.rows[0], { meeting_place: 'Square', visible: true });
    await assert.rejects(db.query('select public.save_event($1::uuid, $2::jsonb)', [
      result.rows[0].id, JSON.stringify({ name: 'Invalid', diagrams: {} }),
    ]));
    const unchangedEvent = await db.query('select name from public.events');
    assert.equal(unchangedEvent.rows[0].name, 'Changed');
    const unchangedDiagram = await db.query('select diagram_data from public.event_diagrams');
    assert.deepEqual(unchangedDiagram.rows[0].diagram_data, payload.events[0].detail.diagrams[0]);
    await db.query('select public.save_event($1::uuid, $2::jsonb)', [
      result.rows[0].id, JSON.stringify({ name: 'Changed', diagrams: [{ danceName: 'First' }, { danceName: 'Second' }] }),
    ]);
    const updatedDiagrams = await db.query('select diagram_data from public.event_diagrams order by position');
    assert.deepEqual(updatedDiagrams.rows.map(row => row.diagram_data.danceName), ['First', 'Second']);
    const relations = await db.query('select member_id,related_member_id from public.member_relations');
    assert.deepEqual(relations.rows, [{ member_id: '1', related_member_id: '2' }]);
    await db.query('select public.save_member($1::jsonb)', [JSON.stringify({
      id: '1', alias: 'Alicia', name: 'Alice', type: 'ADULT', roles: ['ADMIN'], active: true,
      email: 'alice@example.invalid', relations: ['2'],
    })]);
    const renamed = await db.query(`
      select m.alias from public.event_attendance a
      join public.members m on m.id=a.member_id where a.member_id='1'
    `);
    assert.equal(renamed.rows[0].alias, 'Alicia');
    const saved = await db.query("select name, type, roles, active from public.members where id='1'");
    assert.deepEqual(saved.rows[0], { name: 'Alice', type: 'ADULT', roles: ['ADMIN'], active: true });
    await assert.rejects(db.exec("insert into public.training_attendance(training_id,member_id) values(gen_random_uuid(),'1')"));
    await assert.rejects(db.query('select public.save_member($1::jsonb)', [JSON.stringify({ id: '1', alias: 'Changed', relations: ['missing'] })]));
    const unchanged = await db.query("select alias from public.members where id='1'");
    assert.equal(unchanged.rows[0].alias, 'Alicia');
    const invalid = structuredClone(payload);
    invalid.events[0].detail.attendees = ['Unknown'];
    await assert.rejects(db.query('select public.import_legacy_data($1::jsonb)', [JSON.stringify(invalid)]));
    const preserved = await db.query('select count(*)::int as count from public.event_attendance');
    assert.equal(preserved.rows[0].count, 2);
    const extra = structuredClone(payload);
    extra.members[0].unknown = 'keep';
    await assert.rejects(db.query('select public.import_legacy_data($1::jsonb)', [JSON.stringify(extra)]));
    const badTraining = structuredClone(payload);
    badTraining.trainings[0].unknown = 'keep';
    await assert.rejects(db.query('select public.import_legacy_data($1::jsonb)', [JSON.stringify(badTraining)]));
    const badPosition = structuredClone(payload);
    badPosition.memberPositions.Alice.Dance = { '01': 'YES' };
    await assert.rejects(db.query('select public.import_legacy_data($1::jsonb)', [JSON.stringify(badPosition)]));
    badPosition.memberPositions.Alice.Dance = { 1: null };
    await assert.rejects(db.query('select public.import_legacy_data($1::jsonb)', [JSON.stringify(badPosition)]));
    badPosition.memberPositions.Alice.Dance = { 1: 'MAYBE' };
    await assert.rejects(db.query('select public.import_legacy_data($1::jsonb)', [JSON.stringify(badPosition)]));
    badTraining.trainings[0] = { ...payload.trainings[0], description: { text: 'not text' } };
    await assert.rejects(db.query('select public.import_legacy_data($1::jsonb)', [JSON.stringify(badTraining)]));
  } finally {
    await db.close();
  }
});

test('position upgrade expands values, preserves empty dances and rolls back invalid keys', async () => {
  const db = await database();
  try {
    await db.exec(baseline);
    await db.exec(`
      drop table public.member_positions, public.member_dances;
      drop function public.legacy_position_status(text);
      drop type public.position_status;
      create table public.member_positions (
        member_id text not null references public.members(id),
        dance_id uuid not null references public.dances(id),
        position_data jsonb not null, updated_at timestamptz not null default now(),
        primary key (member_id, dance_id)
      );
      insert into public.members(id, alias) values ('1', 'Alice');
      insert into public.dances(id, name) values
        ('025f2d6e-af67-48fd-a7a1-29234a876300','Dance'),
        ('025f2d6e-af67-48fd-a7a1-29234a876301','Empty');
      insert into public.member_positions(member_id,dance_id,position_data,updated_at) values
        ('1','025f2d6e-af67-48fd-a7a1-29234a876300','{"1":"SI","2":"","01":"invalid"}','2020-01-01T00:00:00Z'),
        ('1','025f2d6e-af67-48fd-a7a1-29234a876301','{}','2020-01-01T00:00:00Z');
    `);
    const upgrade = execFileSync(process.execPath, ['scripts/build-position-rows-upgrade.mjs'], { encoding: 'utf8' });
    await assert.rejects(db.exec(upgrade));
    await db.exec("rollback; update public.member_positions set position_data = position_data - '01'");
    await db.exec(upgrade);
    const positions = await db.query("select position_order, status, updated_at::text from public.member_positions order by position_order");
    assert.deepEqual(positions.rows.map(row => [row.position_order, row.status]), [[1, 'known'], [2, null]]);
    assert.ok(positions.rows.every(row => row.updated_at.startsWith('2020-01-01')));
    const parents = await db.query('select count(*)::int as count from public.member_dances');
    assert.equal(parents.rows[0].count, 2);
    await db.query('select public.import_legacy_data($1::jsonb)', [JSON.stringify(payload)]);
    const imported = await db.query('select count(*)::int as count from public.member_positions');
    assert.equal(imported.rows[0].count, 4);
  } finally {
    await db.close();
  }
});

test('attendance and position enum upgrades preserve all states and roll back invalid values', async () => {
  const db = await database();
  try {
    await db.exec(baseline);
    await db.exec(`
      alter table public.event_attendance drop column attending, add column status text;
      alter table public.training_attendance drop column attending, add column status text;
      alter table public.member_positions drop column status, add column value text not null;
      drop function public.legacy_position_status(text);
      drop type public.position_status;
      insert into public.members(id, alias) values ('1', 'Alice'), ('2', 'Bob'), ('3', 'Carol');
      insert into public.events(id, name) values ('025f2d6e-af67-48fd-a7a1-29234a876300','Event');
      insert into public.trainings(id, training_date) values ('025f2d6e-af67-48fd-a7a1-29234a876301','2020-01-01');
      insert into public.event_attendance(event_id,member_id,status,note) values
        ('025f2d6e-af67-48fd-a7a1-29234a876300','1','SI',null),
        ('025f2d6e-af67-48fd-a7a1-29234a876300','2','NO',null),
        ('025f2d6e-af67-48fd-a7a1-29234a876300','3',null,'note');
      insert into public.training_attendance(training_id,member_id,status) values
        ('025f2d6e-af67-48fd-a7a1-29234a876301','1','unexpected');
      insert into public.dances(id,name) values ('025f2d6e-af67-48fd-a7a1-29234a876302','Dance');
      insert into public.member_dances(member_id,dance_id) values ('1','025f2d6e-af67-48fd-a7a1-29234a876302');
      insert into public.member_positions(member_id,dance_id,position_order,value) values
        ('1','025f2d6e-af67-48fd-a7a1-29234a876302',1,'SI'),
        ('1','025f2d6e-af67-48fd-a7a1-29234a876302',2,'EN PROGRES'),
        ('1','025f2d6e-af67-48fd-a7a1-29234a876302',3,'NO'),
        ('1','025f2d6e-af67-48fd-a7a1-29234a876302',4,''),
        ('1','025f2d6e-af67-48fd-a7a1-29234a876302',5,'unexpected');
    `);
    const attendanceUpgrade = execFileSync(process.execPath, ['scripts/build-attendance-boolean-upgrade.mjs'], { encoding: 'utf8' });
    await assert.rejects(db.exec(attendanceUpgrade));
    await db.exec("rollback; update public.training_attendance set status='NO'");
    await db.exec(attendanceUpgrade);
    const attendance = await db.query('select member_id,attending,note from public.event_attendance order by member_id');
    assert.deepEqual(attendance.rows, [
      { member_id: '1', attending: true, note: null }, { member_id: '2', attending: false, note: null },
      { member_id: '3', attending: null, note: 'note' },
    ]);
    const positionsUpgrade = execFileSync(process.execPath, ['scripts/build-position-enum-upgrade.mjs'], { encoding: 'utf8' });
    await assert.rejects(db.exec(positionsUpgrade));
    await db.exec("rollback; delete from public.member_positions where position_order=5");
    await db.exec(positionsUpgrade);
    const positions = await db.query('select status from public.member_positions order by position_order');
    assert.deepEqual(positions.rows.map(row => row.status), ['known', 'learning', 'not_known', null]);
    await db.query('select public.import_legacy_data($1::jsonb)', [JSON.stringify(payload)]);
  } finally {
    await db.close();
  }
});

test('training upgrade preserves IDs, multiline descriptions, attendance and rejects unknown data', async () => {
  const db = await database();
  try {
    await db.exec(baseline);
    await db.exec(`
      alter table public.trainings drop column description, add column training_data jsonb not null default '{}'::jsonb;
      insert into public.members(id, alias) values ('1', 'Alice');
      insert into public.trainings(id, legacy_id, training_date, training_data) values
        ('025f2d6e-af67-48fd-a7a1-29234a876300', 'old', '2020-01-01T10:00', '{"description":"First\\nSecond","unknown":"keep"}');
      insert into public.training_attendance(training_id, member_id, attending, note)
        values ('025f2d6e-af67-48fd-a7a1-29234a876300', '1', true, 'note');
    `);
    const upgrade = execFileSync(process.execPath, ['scripts/build-training-columns-upgrade.mjs'], { encoding: 'utf8' });
    await assert.rejects(db.exec(upgrade));
    await db.exec("rollback; update public.trainings set training_data = '{\"description\": {\"unexpected\":true}}'");
    await assert.rejects(db.exec(upgrade));
    await db.exec("rollback; update public.trainings set training_data = '{\"description\":\"First\\nSecond\"}'");
    await db.exec(upgrade);
    const training = await db.query('select id::text, legacy_id, description from public.trainings');
    assert.deepEqual(training.rows, [{ id: '025f2d6e-af67-48fd-a7a1-29234a876300', legacy_id: 'old', description: 'First\nSecond' }]);
    const attendance = await db.query('select training_id::text, member_id, attending, note from public.training_attendance');
    assert.deepEqual(attendance.rows, [{ training_id: '025f2d6e-af67-48fd-a7a1-29234a876300', member_id: '1', attending: true, note: 'note' }]);
    await db.query('select public.import_legacy_data($1::jsonb)', [JSON.stringify(payload)]);
    const imported = await db.query('select description from public.trainings');
    assert.equal(imported.rows[0].description, 'First line\nSecond line');
  } finally {
    await db.close();
  }
});

test('member upgrade retains relationships and rejects unsupported data transactionally', async () => {
  const db = await database();
  try {
    await db.exec(baseline);
    await db.exec(`
      alter table public.members drop column name, drop column type, drop column roles, drop column active,
        add column member_data jsonb not null default '{}'::jsonb;
      insert into public.members(id,email,alias,member_data) values
        ('1','alice@example.invalid','Alice','{"id":"1","email":"alice@example.invalid","alias":"Alice","name":"Alice Smith","type":"ADULT","roles":["ADMIN","OTHER"],"active":false,"unknown":"keep"}'),
        ('2',null,'Bob','{"id":"2","alias":"Bob","name":"Bob"}');
      insert into public.member_relations(member_id,related_member_id,position) values ('1','2',1);
    `);
    const upgrade = execFileSync(process.execPath, ['scripts/build-member-columns-upgrade.mjs'], { encoding: 'utf8' });
    await assert.rejects(db.exec(upgrade));
    await db.exec("rollback; update public.members set member_data = member_data - 'unknown'");
    await db.exec(upgrade);
    const members = await db.query("select id, name, type, roles, active from public.members order by id");
    assert.deepEqual(members.rows, [
      { id: '1', name: 'Alice Smith', type: 'ADULT', roles: ['ADMIN', 'OTHER'], active: false },
      { id: '2', name: 'Bob', type: '', roles: [], active: true },
    ]);
    const relations = await db.query('select member_id,related_member_id from public.member_relations');
    assert.deepEqual(relations.rows, [{ member_id: '1', related_member_id: '2' }]);
    await db.query('select public.import_legacy_data($1::jsonb)', [JSON.stringify(payload)]);
    const imported = await db.query("select roles from public.members where id='1'");
    assert.deepEqual(imported.rows[0].roles, ['ADMIN', 'OTHER']);
  } finally {
    await db.close();
  }
});

test('event column upgrade preserves existing IDs, fields and diagrams and rejects unknown data', async () => {
  const db = await database();
  try {
    await db.exec(baseline);
    await db.exec(`
      drop function public.save_event(uuid, jsonb);
      drop table public.event_diagrams;
      alter table public.events drop column event_datetime, drop column meeting_place, drop column place_url, drop column attendance_list_id,
        drop column confirmed, drop column visible, add column event_data jsonb not null default '{}'::jsonb;
      insert into public.events(id, legacy_id, name, event_date, event_data)
      values ('025f2d6e-af67-48fd-a7a1-29234a876300', 'old', 'Event', '2020-01-01T10:00',
        '{"datetime":"2020-01-01T11:00","meetingPlace":"Square","placeUrl":"url","attendanceListId":"sheet","confirmed":true,"visible":true,"diagrams":[{"danceName":"Dance","groups":[["Alice"]]}],"unknown":"keep"}');
      insert into public.members(id, alias) values ('1', 'Alice');
      insert into public.event_attendance(event_id, member_id, attending)
        values ('025f2d6e-af67-48fd-a7a1-29234a876300', '1', true);
    `);
    const upgrade = execFileSync(process.execPath, ['scripts/build-event-columns-upgrade.mjs'], { encoding: 'utf8' });
    await assert.rejects(db.exec(upgrade));
    await db.exec("rollback; update public.events set event_data = event_data - 'unknown'");
    await db.exec(upgrade);
    const event = await db.query('select id::text, legacy_id, event_datetime, meeting_place, place_url, attendance_list_id, confirmed, visible from public.events');
    assert.deepEqual(event.rows[0], { id: '025f2d6e-af67-48fd-a7a1-29234a876300', legacy_id: 'old',
      event_datetime: '2020-01-01T11:00', meeting_place: 'Square', place_url: 'url', attendance_list_id: 'sheet', confirmed: true, visible: true });
    const diagrams = await db.query('select diagram_data from public.event_diagrams');
    assert.deepEqual(diagrams.rows, [{ diagram_data: { danceName: 'Dance', groups: [['Alice']] } }]);
    const attendance = await db.query('select event_id::text, member_id, attending from public.event_attendance');
    assert.deepEqual(attendance.rows, [{ event_id: '025f2d6e-af67-48fd-a7a1-29234a876300', member_id: '1', attending: true }]);
    await db.query('select public.import_legacy_data($1::jsonb)', [JSON.stringify(payload)]);
    const imported = await db.query('select count(*)::int as count from public.event_diagrams');
    assert.equal(imported.rows[0].count, 1);
  } finally {
    await db.close();
  }
});

test('upgrade preserves relationships and rejects ambiguous data transactionally', async () => {
  const db = await database();
  try {
    await db.exec(`
      create table public.members(id text primary key, email text, alias text, member_data jsonb, updated_at timestamptz default now());
      create table public.events(id text primary key, name text, event_date text, event_data jsonb, updated_at timestamptz default now());
      create table public.trainings(id text primary key, training_data jsonb, updated_at timestamptz default now());
      create table public.attendance(entity_type text, entity_id text, member_alias text, status text, note text, updated_at timestamptz default now());
      create table public.member_positions(member_alias text, dance_name text, position_data jsonb, updated_at timestamptz default now());
      create table public.push_tokens(token text, user_email text, created_at timestamptz default now());
      create table public.data_versions(name text, version bigint);
      create table public.registration_requests(id bigint generated always as identity primary key, name text, email text, created_at timestamptz default now());
      create function public.import_legacy_data(jsonb) returns jsonb language sql as $$select '{}'::jsonb$$;
      insert into public.members(id,email,alias,member_data) values ('1','alice@example.invalid','Alice','{"id":"1","alias":"Alice"}');
      insert into public.events(id,name,event_date,event_data) values ('Old event','Old event','2026-01-01T10:00','{"diagrams":[]}');
      insert into public.trainings(id,training_data) values ('2026-01-02T10:00','{"description":"test"}');
      insert into public.attendance(entity_type,entity_id,member_alias,status,note) values ('event','Old event','Alice','SI','note'),('training','2026-01-02T10:00','Alice','NO',null);
      insert into public.member_positions(member_alias,dance_name,position_data) values ('Alice','Dance','{"1":"SI"}');
      insert into public.push_tokens(token,user_email) values ('token','alice@example.invalid');
      insert into public.registration_requests(name,email) values ('test','test@example.invalid');
    `);
    const upgrade = execFileSync(process.execPath, ['scripts/build-relational-upgrade.mjs'], { encoding: 'utf8' });
    await db.exec("insert into public.attendance(entity_type,entity_id,member_alias,status,note) values ('event','Old event','Unknown','SI',null)");
    await assert.rejects(db.exec(upgrade));
    await db.exec('rollback; delete from public.attendance where member_alias=\'Unknown\'');
    await db.exec(upgrade);
    const result = await db.query(`
      select (select count(*)::int from public.event_attendance) events,
        (select count(*)::int from public.training_attendance) trainings,
        (select count(*)::int from public.member_positions) positions,
        (select count(*)::int from public.push_tokens) tokens,
        (select count(*)::int from public.registration_requests) requests
    `);
    assert.deepEqual(result.rows[0], { events: 1, trainings: 1, positions: 1, tokens: 1, requests: 1 });
  } finally {
    await db.close();
  }
});
