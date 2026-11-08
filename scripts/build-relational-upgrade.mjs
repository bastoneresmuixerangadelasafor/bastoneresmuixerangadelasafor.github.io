import { readFile } from "node:fs/promises";

const schema = await readFile(new URL("../supabase/migrations/202611070001_initial_schema.sql", import.meta.url), "utf8");

const before = `
begin;
lock table public.members, public.events, public.trainings, public.attendance,
  public.member_positions, public.push_tokens, public.data_versions, public.registration_requests
  in share row exclusive mode;
do $$
begin
  if exists (select 1 from public.attendance a where not exists (
    select 1 from public.members m where lower(trim(m.alias)) = lower(trim(a.member_alias))))
    or exists (select 1 from public.attendance a where
      (a.entity_type = 'event' and not exists (select 1 from public.events e where e.id = a.entity_id))
      or (a.entity_type = 'training' and not exists (select 1 from public.trainings t where t.id = a.entity_id))
      or a.entity_type not in ('event', 'training'))
    or exists (select 1 from public.member_positions p where not exists (
      select 1 from public.members m where lower(trim(m.alias)) = lower(trim(p.member_alias))))
    or exists (select 1 from public.push_tokens p where not exists (
      select 1 from public.members m where lower(trim(m.email)) = lower(trim(p.user_email))))
    or exists (select 1 from public.members group by lower(trim(alias)) having count(*) > 1)
    or exists (select 1 from public.members where email is not null and trim(email) <> ''
      group by lower(trim(email)) having count(*) > 1) then
    raise exception 'Legacy relationships are missing or ambiguous; no tables were changed';
  end if;
end;
$$;
create temporary table legacy_counts on commit drop as
select (select count(*) from public.members) members,
  (select count(*) from public.events) events,
  (select count(*) from public.trainings) trainings,
  (select count(*) from public.attendance) attendance,
  (select count(*) from public.member_positions) positions,
  (select count(*) from public.push_tokens) tokens;
create temporary table legacy_member_times on commit drop as select id, updated_at from public.members;
create temporary table legacy_event_times on commit drop as select id, updated_at from public.events;
create temporary table legacy_training_times on commit drop as select id, updated_at from public.trainings;
create temporary table legacy_attendance_times on commit drop as select entity_type, entity_id, member_alias, updated_at from public.attendance;
create temporary table legacy_position_times on commit drop as select member_alias, dance_name, updated_at from public.member_positions;
create temporary table legacy_token_times on commit drop as select token, created_at from public.push_tokens;
create temporary table legacy_snapshot on commit drop as
select jsonb_build_object(
  'members', coalesce((select jsonb_agg(member_data || jsonb_build_object(
    'id', id, 'email', email, 'alias', alias)) from public.members), '[]'::jsonb),
  'events', coalesce((select jsonb_agg(jsonb_build_object(
    'id', e.id, 'name', e.name, 'date', e.event_date,
    'meetingPlace', e.event_data->>'meetingPlace', 'placeUrl', e.event_data->>'placeUrl',
    'confirmed', coalesce((e.event_data->>'confirmed')::boolean, false),
    'visible', coalesce((e.event_data->>'visible')::boolean, false),
    'detail', e.event_data || jsonb_build_object(
      'attendees', coalesce((select jsonb_agg(a.member_alias) from public.attendance a where a.entity_type='event' and a.entity_id=e.id and a.status='SI'), '[]'::jsonb),
      'rejections', coalesce((select jsonb_agg(a.member_alias) from public.attendance a where a.entity_type='event' and a.entity_id=e.id and a.status='NO'), '[]'::jsonb),
      'notes', coalesce((select jsonb_object_agg(a.member_alias, a.note) from public.attendance a where a.entity_type='event' and a.entity_id=e.id and a.note is not null), '{}'::jsonb)
    ))) from public.events e), '[]'::jsonb),
  'trainings', coalesce((select jsonb_agg(t.training_data || jsonb_build_object(
    'id', t.id, 'date', t.id,
    'attendees', coalesce((select jsonb_agg(a.member_alias) from public.attendance a where a.entity_type='training' and a.entity_id=t.id and a.status='SI'), '[]'::jsonb),
    'rejections', coalesce((select jsonb_agg(a.member_alias) from public.attendance a where a.entity_type='training' and a.entity_id=t.id and a.status='NO'), '[]'::jsonb),
    'notes', coalesce((select jsonb_object_agg(a.member_alias, a.note) from public.attendance a where a.entity_type='training' and a.entity_id=t.id and a.note is not null), '{}'::jsonb)
  )) from public.trainings t), '[]'::jsonb),
  'memberPositions', coalesce((select jsonb_object_agg(member_alias, positions) from (
    select member_alias, jsonb_object_agg(dance_name, position_data) positions
    from public.member_positions group by member_alias
  ) p), '{}'::jsonb),
  'pushTokens', coalesce((select jsonb_object_agg(user_email, tokens) from (
    select user_email, jsonb_agg(token) tokens from public.push_tokens group by user_email
  ) p), '{}'::jsonb),
  'dataVersions', coalesce((select jsonb_object_agg(name, version) from public.data_versions), '{}'::jsonb)
) payload;
create temporary table legacy_registration_requests on commit drop as select * from public.registration_requests;
drop function public.import_legacy_data(jsonb);
drop table public.attendance, public.member_positions, public.push_tokens, public.events,
  public.trainings, public.members, public.data_versions, public.registration_requests;
`;

const after = `
select set_config('request.jwt.claim.role', 'service_role', true);
select public.import_legacy_data(payload) from legacy_snapshot;
update public.members m set updated_at = old.updated_at from legacy_member_times old where m.id = old.id;
update public.events e set updated_at = old.updated_at from legacy_event_times old where e.legacy_id = old.id;
update public.trainings t set updated_at = old.updated_at from legacy_training_times old where t.legacy_id = old.id;
update public.event_attendance a set updated_at = old.updated_at
  from legacy_attendance_times old, public.events e, public.members m
  where old.entity_type = 'event' and e.legacy_id = old.entity_id
    and lower(trim(m.alias)) = lower(trim(old.member_alias)) and a.event_id = e.id and a.member_id = m.id;
update public.training_attendance a set updated_at = old.updated_at
  from legacy_attendance_times old, public.trainings t, public.members m
  where old.entity_type = 'training' and t.legacy_id = old.entity_id
    and lower(trim(m.alias)) = lower(trim(old.member_alias)) and a.training_id = t.id and a.member_id = m.id;
update public.member_dances p set updated_at = old.updated_at
  from legacy_position_times old, public.members m, public.dances d
  where lower(trim(m.alias)) = lower(trim(old.member_alias)) and d.name = old.dance_name
    and p.member_id = m.id and p.dance_id = d.id;
update public.member_positions p set updated_at = parent.updated_at
  from public.member_dances parent where parent.member_id = p.member_id and parent.dance_id = p.dance_id;
update public.push_tokens p set created_at = old.created_at from legacy_token_times old where p.token = old.token;
do $$
declare expected record;
begin
  select * into expected from legacy_counts;
  if expected.members <> (select count(*) from public.members)
    or expected.events <> (select count(*) from public.events)
    or expected.trainings <> (select count(*) from public.trainings)
    or expected.attendance <> ((select count(*) from public.event_attendance) + (select count(*) from public.training_attendance))
    or expected.positions <> (select count(*) from public.member_dances)
    or expected.tokens <> (select count(*) from public.push_tokens) then
    raise exception 'Migrated row counts do not match; the upgrade was rolled back';
  end if;
end;
$$;
insert into public.registration_requests (id, name, email, created_at)
  overriding system value select id, name, email, created_at from legacy_registration_requests;
select setval(pg_get_serial_sequence('public.registration_requests', 'id'),
  greatest(coalesce((select max(id) from public.registration_requests), 0), 1),
  exists(select 1 from public.registration_requests));
commit;
`;

process.stdout.write(before + schema + after);
