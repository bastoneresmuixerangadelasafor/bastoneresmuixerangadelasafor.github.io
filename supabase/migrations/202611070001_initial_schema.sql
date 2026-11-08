create table public.members (
  id text primary key,
  email text,
  alias text not null,
  name text not null default '',
  type text not null default '',
  roles text[] not null default '{}',
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create unique index members_alias_unique on public.members (lower(trim(alias)));
create unique index members_email_unique on public.members (lower(trim(email))) where email is not null and trim(email) <> '';

create table public.member_relations (
  member_id text not null references public.members(id) on delete cascade,
  related_member_id text not null references public.members(id) on delete restrict,
  position integer not null,
  primary key (member_id, related_member_id),
  unique (member_id, position)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  event_date text,
  event_datetime text,
  meeting_place text,
  place_url text,
  attendance_list_id text,
  confirmed boolean not null default false,
  visible boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.event_diagrams (
  event_id uuid not null references public.events(id) on delete cascade,
  position integer not null,
  diagram_data jsonb not null,
  primary key (event_id, position)
);

create table public.trainings (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  training_date text not null unique,
  description text not null default '',
  updated_at timestamptz not null default now()
);

create table public.dances (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create type public.position_status as enum ('known', 'learning', 'not_known');

create function public.legacy_position_status(p_value text)
returns public.position_status
language plpgsql
immutable
set search_path = ''
as $$
begin
  case upper(trim(p_value))
    when '' then return null;
    when 'SI' then return 'known'::public.position_status;
    when 'EN PROGRES' then return 'learning'::public.position_status;
    when 'NO' then return 'not_known'::public.position_status;
    else raise exception 'Unsupported legacy position status: %', p_value;
  end case;
end;
$$;

create table public.event_attendance (
  event_id uuid not null references public.events(id) on delete cascade,
  member_id text not null references public.members(id) on delete restrict,
  attending boolean,
  note text,
  updated_at timestamptz not null default now(),
  primary key (event_id, member_id)
);

create table public.training_attendance (
  training_id uuid not null references public.trainings(id) on delete cascade,
  member_id text not null references public.members(id) on delete restrict,
  attending boolean,
  note text,
  updated_at timestamptz not null default now(),
  primary key (training_id, member_id)
);

create table public.member_dances (
  member_id text not null references public.members(id) on delete restrict,
  dance_id uuid not null references public.dances(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (member_id, dance_id)
);

create table public.member_positions (
  member_id text not null,
  dance_id uuid not null,
  position_order integer not null check (position_order >= 0),
  status public.position_status,
  updated_at timestamptz not null default now(),
  primary key (member_id, dance_id, position_order),
  foreign key (member_id, dance_id) references public.member_dances(member_id, dance_id) on delete cascade
);

create table public.push_tokens (
  token text primary key,
  member_id text not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.registration_requests (
  id bigint generated always as identity primary key,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.data_versions (
  name text primary key,
  version bigint not null default 0
);

insert into storage.buckets (id, name, public)
values ('dance-audio', 'dance-audio', false)
on conflict (id) do nothing;

alter table public.members enable row level security;
alter table public.member_relations enable row level security;
alter table public.events enable row level security;
alter table public.event_diagrams enable row level security;
alter table public.trainings enable row level security;
alter table public.dances enable row level security;
alter table public.event_attendance enable row level security;
alter table public.training_attendance enable row level security;
alter table public.member_positions enable row level security;
alter table public.member_dances enable row level security;
alter table public.push_tokens enable row level security;
alter table public.registration_requests enable row level security;
alter table public.data_versions enable row level security;

revoke all on public.members, public.member_relations, public.events, public.event_diagrams, public.trainings, public.dances,
  public.event_attendance, public.training_attendance, public.member_positions, public.member_dances,
  public.push_tokens, public.registration_requests, public.data_versions from anon, authenticated;
grant all on public.members, public.member_relations, public.events, public.event_diagrams, public.trainings, public.dances,
  public.event_attendance, public.training_attendance, public.member_positions, public.member_dances,
  public.push_tokens, public.registration_requests, public.data_versions to service_role;
grant usage, select on all sequences in schema public to service_role;

create function public.import_legacy_data(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  detail jsonb;
  entity_id uuid;
  v_member_id text;
  member_alias text;
  entry record;
  v_token text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role is required';
  end if;
  if jsonb_typeof(p_payload->'members') is distinct from 'array'
    or jsonb_typeof(p_payload->'events') is distinct from 'array'
    or jsonb_typeof(p_payload->'trainings') is distinct from 'array'
    or jsonb_typeof(p_payload->'memberPositions') is distinct from 'object' then
    raise exception 'Invalid legacy export payload';
  end if;

  truncate public.event_diagrams, public.event_attendance, public.training_attendance, public.member_positions, public.member_dances, public.member_relations,
    public.push_tokens, public.events, public.trainings, public.dances, public.members,
    public.data_versions;

  for item in select value from jsonb_array_elements(p_payload->'members') loop
    if item - array['id', 'email', 'alias', 'name', 'type', 'roles', 'active', 'relations', 'relatedMembers'] <> '{}'::jsonb then
      raise exception 'Unsupported member fields for member %: %', item->>'id',
        item - array['id', 'email', 'alias', 'name', 'type', 'roles', 'active', 'relations', 'relatedMembers'];
    end if;
    insert into public.members (id, email, alias, name, type, roles, active)
    values (item->>'id', nullif(item->>'email', ''),
      coalesce(nullif(item->>'alias', ''), item->>'name', ''),
      coalesce(item->>'name', ''), coalesce(item->>'type', ''),
      array(select jsonb_array_elements_text(coalesce(nullif(item->'roles', 'null'::jsonb), '[]'::jsonb))),
      coalesce((item->>'active')::boolean, true));
  end loop;
  for item in select value from jsonb_array_elements(p_payload->'members') loop
    insert into public.member_relations (member_id, related_member_id, position)
    select item->>'id', relation.value, relation.ordinality::integer
    from jsonb_array_elements_text(coalesce(nullif(item->'relations', 'null'::jsonb), '[]'::jsonb))
      with ordinality as relation(value, ordinality);
  end loop;

  for item in select value from jsonb_array_elements(p_payload->'events') loop
    detail := coalesce(nullif(item->'detail', 'null'::jsonb), '{}'::jsonb);
    if detail - array['id', 'name', 'date', 'datetime', 'meetingPlace', 'placeUrl',
      'attendanceListId', 'confirmed', 'visible', 'diagrams', 'attendees', 'rejections', 'notes'] <> '{}'::jsonb then
      raise exception 'Unsupported event detail fields for event %: %', item->>'name',
        detail - array['id', 'name', 'date', 'datetime', 'meetingPlace', 'placeUrl',
          'attendanceListId', 'confirmed', 'visible', 'diagrams', 'attendees', 'rejections', 'notes'];
    end if;
    insert into public.events (legacy_id, name, event_date, event_datetime, meeting_place, place_url, attendance_list_id, confirmed, visible)
    values (coalesce(item->>'id', item->>'name'), coalesce(item->>'name', item->>'id'),
      coalesce(item->>'date', detail->>'datetime'),
      detail->>'datetime',
      coalesce(item->>'meetingPlace', detail->>'meetingPlace'),
      coalesce(item->>'placeUrl', detail->>'placeUrl'), detail->>'attendanceListId',
      coalesce((item->>'confirmed')::boolean, (detail->>'confirmed')::boolean, false),
      coalesce((item->>'visible')::boolean, (detail->>'visible')::boolean, false))
    returning id into entity_id;

    insert into public.event_diagrams (event_id, position, diagram_data)
    select entity_id, diagram.ordinality::integer, diagram.value
    from jsonb_array_elements(coalesce(nullif(detail->'diagrams', 'null'::jsonb), '[]'::jsonb))
      with ordinality as diagram(value, ordinality);

    for member_alias in select jsonb_array_elements_text(coalesce(nullif(detail->'attendees', 'null'::jsonb), '[]'::jsonb)) loop
      select id into strict v_member_id from public.members where lower(trim(alias)) = lower(trim(member_alias));
      insert into public.event_attendance (event_id, member_id, attending) values (entity_id, v_member_id, true);
    end loop;
    for member_alias in select jsonb_array_elements_text(coalesce(nullif(detail->'rejections', 'null'::jsonb), '[]'::jsonb)) loop
      select id into strict v_member_id from public.members where lower(trim(alias)) = lower(trim(member_alias));
      insert into public.event_attendance (event_id, member_id, attending) values (entity_id, v_member_id, false)
      on conflict (event_id, member_id) do update set attending = excluded.attending;
    end loop;
    for entry in select key, value from jsonb_each(coalesce(nullif(detail->'notes', 'null'::jsonb), '{}'::jsonb)) loop
      select id into strict v_member_id from public.members where lower(trim(alias)) = lower(trim(entry.key));
      insert into public.event_attendance (event_id, member_id, note) values (entity_id, v_member_id, entry.value #>> '{}')
      on conflict (event_id, member_id) do update set note = excluded.note;
    end loop;
  end loop;

  for item in select value from jsonb_array_elements(p_payload->'trainings') loop
    if item - array['id', 'date', 'description', 'attendees', 'rejections', 'notes'] <> '{}'::jsonb
      or (item ? 'description' and jsonb_typeof(item->'description') not in ('string', 'null')) then
      raise exception 'Unsupported training fields or description type for training %', item->>'id';
    end if;
    insert into public.trainings (legacy_id, training_date, description)
    values (coalesce(item->>'id', item->>'date'), item->>'date', coalesce(item->>'description', ''))
    returning id into entity_id;
    for member_alias in select jsonb_array_elements_text(coalesce(nullif(item->'attendees', 'null'::jsonb), '[]'::jsonb)) loop
      select id into strict v_member_id from public.members where lower(trim(alias)) = lower(trim(member_alias));
      insert into public.training_attendance (training_id, member_id, attending) values (entity_id, v_member_id, true);
    end loop;
    for member_alias in select jsonb_array_elements_text(coalesce(nullif(item->'rejections', 'null'::jsonb), '[]'::jsonb)) loop
      select id into strict v_member_id from public.members where lower(trim(alias)) = lower(trim(member_alias));
      insert into public.training_attendance (training_id, member_id, attending) values (entity_id, v_member_id, false)
      on conflict (training_id, member_id) do update set attending = excluded.attending;
    end loop;
    for entry in select key, value from jsonb_each(coalesce(nullif(item->'notes', 'null'::jsonb), '{}'::jsonb)) loop
      select id into strict v_member_id from public.members where lower(trim(alias)) = lower(trim(entry.key));
      insert into public.training_attendance (training_id, member_id, note) values (entity_id, v_member_id, entry.value #>> '{}')
      on conflict (training_id, member_id) do update set note = excluded.note;
    end loop;
  end loop;

  for member_alias, detail in select key, value from jsonb_each(p_payload->'memberPositions') loop
    select id into strict v_member_id from public.members where lower(trim(alias)) = lower(trim(member_alias));
    for entry in select key, value from jsonb_each(detail) loop
      if jsonb_typeof(entry.value) is distinct from 'object' then
        raise exception 'Invalid positions for member % and dance %', member_alias, entry.key;
      end if;
      if exists (select 1 from jsonb_each(entry.value) position
        where not (case when position.key ~ '^(0|[1-9][0-9]{0,9})$'
          then position.key::numeric <= 2147483647 else false end)
        or jsonb_typeof(position.value) <> 'string') then
        raise exception 'Unsupported position key or value for member % and dance %', member_alias, entry.key;
      end if;
      insert into public.dances (name) values (entry.key) on conflict (name) do nothing;
      insert into public.member_dances (member_id, dance_id)
      select v_member_id, id from public.dances where name = entry.key;
      insert into public.member_positions (member_id, dance_id, position_order, status)
      select v_member_id, d.id, position.key::integer, public.legacy_position_status(position.value #>> '{}')
      from public.dances d cross join lateral jsonb_each(entry.value) position where d.name = entry.key;
    end loop;
  end loop;

  for entry in select key, value from jsonb_each(coalesce(nullif(p_payload->'dataVersions', 'null'::jsonb), '{}'::jsonb)) loop
    insert into public.data_versions (name, version) values (entry.key, coalesce(nullif(entry.value #>> '{}', '')::bigint, 0));
  end loop;
  for entry in select key, value from jsonb_each(coalesce(nullif(p_payload->'pushTokens', 'null'::jsonb), '{}'::jsonb)) loop
    select id into strict v_member_id from public.members where lower(trim(email)) = lower(trim(entry.key));
    for v_token in select jsonb_array_elements_text(entry.value) loop
      insert into public.push_tokens (token, member_id) values (v_token, v_member_id)
      on conflict (token) do update set member_id = excluded.member_id;
    end loop;
  end loop;
  return jsonb_build_object('members', (select count(*) from public.members),
    'events', (select count(*) from public.events), 'trainings', (select count(*) from public.trainings),
    'attendance', (select count(*) from public.event_attendance) + (select count(*) from public.training_attendance),
    'memberPositions', (select count(*) from public.member_dances));
end;
$$;

revoke all on function public.import_legacy_data(jsonb) from public, anon, authenticated;
grant execute on function public.import_legacy_data(jsonb) to service_role;

create function public.save_event(p_id uuid, p_event jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role is required';
  end if;
  insert into public.events (id, name, event_date, event_datetime, meeting_place, place_url, attendance_list_id, confirmed, visible)
  values (p_id, p_event->>'name', coalesce(nullif(p_event->>'datetime', ''), nullif(p_event->>'date', '')),
    coalesce(nullif(p_event->>'datetime', ''), nullif(p_event->>'date', '')),
    p_event->>'meetingPlace', p_event->>'placeUrl', p_event->>'attendanceListId',
    coalesce((p_event->>'confirmed')::boolean, false), coalesce((p_event->>'visible')::boolean, false))
  on conflict (id) do update set
    name = excluded.name,
    event_date = coalesce(nullif(p_event->>'datetime', ''), nullif(p_event->>'date', ''), public.events.event_date),
    event_datetime = coalesce(nullif(p_event->>'datetime', ''), nullif(p_event->>'date', ''), public.events.event_datetime),
    meeting_place = case when p_event ? 'meetingPlace' then p_event->>'meetingPlace' else public.events.meeting_place end,
    place_url = case when p_event ? 'placeUrl' then p_event->>'placeUrl' else public.events.place_url end,
    attendance_list_id = case when p_event ? 'attendanceListId' then p_event->>'attendanceListId' else public.events.attendance_list_id end,
    confirmed = coalesce((p_event->>'confirmed')::boolean, public.events.confirmed),
    visible = coalesce((p_event->>'visible')::boolean, public.events.visible),
    updated_at = now();
  if p_event ? 'diagrams' then
    delete from public.event_diagrams where event_id = p_id;
    insert into public.event_diagrams (event_id, position, diagram_data)
    select p_id, diagram.ordinality::integer, diagram.value
    from jsonb_array_elements(p_event->'diagrams') with ordinality as diagram(value, ordinality);
  end if;
end;
$$;

revoke all on function public.save_event(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_event(uuid, jsonb) to service_role;

create function public.save_member(p_member jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role is required';
  end if;
  insert into public.members (id, email, alias, name, type, roles, active, updated_at)
  values (p_member->>'id', nullif(p_member->>'email', ''), p_member->>'alias',
    coalesce(p_member->>'name', ''), coalesce(p_member->>'type', ''),
    array(select jsonb_array_elements_text(coalesce(nullif(p_member->'roles', 'null'::jsonb), '[]'::jsonb))),
    coalesce((p_member->>'active')::boolean, true), now())
  on conflict (id) do update set email = excluded.email, alias = excluded.alias,
    name = excluded.name, type = excluded.type, roles = excluded.roles,
    active = excluded.active, updated_at = excluded.updated_at;
  delete from public.member_relations where member_id = p_member->>'id';
  insert into public.member_relations (member_id, related_member_id, position)
  select p_member->>'id', relation.value, relation.ordinality::integer
  from jsonb_array_elements_text(coalesce(nullif(p_member->'relations', 'null'::jsonb), '[]'::jsonb))
    with ordinality as relation(value, ordinality);
end;
$$;

revoke all on function public.save_member(jsonb) from public, anon, authenticated;
grant execute on function public.save_member(jsonb) to service_role;

create function public.save_member_position(p_member_id text, p_dance_name text, p_position_order integer, p_value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_dance_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role is required';
  end if;
  if p_dance_name is null or p_dance_name = '' or p_position_order is null or p_position_order < 0 or p_value is null or p_value = '' then
    raise exception 'Invalid member position';
  end if;
  insert into public.dances (name) values (p_dance_name)
    on conflict (name) do update set name = excluded.name returning id into v_dance_id;
  insert into public.member_dances (member_id, dance_id, updated_at)
    values (p_member_id, v_dance_id, now())
    on conflict (member_id, dance_id) do update set updated_at = excluded.updated_at;
  insert into public.member_positions (member_id, dance_id, position_order, status, updated_at)
    values (p_member_id, v_dance_id, p_position_order, p_value::public.position_status, now())
    on conflict (member_id, dance_id, position_order) do update set status = excluded.status, updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.save_member_position(text, text, integer, text) from public, anon, authenticated;
grant execute on function public.save_member_position(text, text, integer, text) to service_role;
