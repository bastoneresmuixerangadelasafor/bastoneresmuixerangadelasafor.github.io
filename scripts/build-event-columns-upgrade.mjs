import { readFile } from "node:fs/promises";

const schema = await readFile(new URL("../supabase/migrations/202611070001_initial_schema.sql", import.meta.url), "utf8");
const start = schema.indexOf("create function public.import_legacy_data(");
const end = schema.indexOf("create function public.save_member(");
if (start < 0 || end < 0) throw new Error("Could not find event migration functions in the schema");
const functions = schema.slice(start, end).replace("create function public.import_legacy_data(", "create or replace function public.import_legacy_data(");

process.stdout.write(`
begin;
lock table public.events in share row exclusive mode;
do $$
declare invalid record;
begin
  select id, event_data - array['id', 'name', 'date', 'datetime', 'meetingPlace', 'placeUrl',
    'attendanceListId', 'confirmed', 'visible', 'diagrams'] as extra into invalid
  from public.events
  where event_data - array['id', 'name', 'date', 'datetime', 'meetingPlace', 'placeUrl',
    'attendanceListId', 'confirmed', 'visible', 'diagrams'] <> '{}'::jsonb
  limit 1;
  if found then
    raise exception 'Event % has unsupported fields: %', invalid.id, invalid.extra;
  end if;
end;
$$;
alter table public.events
  add column event_datetime text,
  add column meeting_place text,
  add column place_url text,
  add column attendance_list_id text,
  add column confirmed boolean not null default false,
  add column visible boolean not null default false;
create table public.event_diagrams (
  event_id uuid not null references public.events(id) on delete cascade,
  position integer not null,
  diagram_data jsonb not null,
  primary key (event_id, position)
);
alter table public.event_diagrams enable row level security;
revoke all on public.event_diagrams from anon, authenticated;
grant all on public.event_diagrams to service_role;
update public.events set
  event_date = coalesce(event_date, event_data->>'datetime', event_data->>'date'),
  event_datetime = event_data->>'datetime',
  meeting_place = event_data->>'meetingPlace',
  place_url = event_data->>'placeUrl',
  attendance_list_id = event_data->>'attendanceListId',
  confirmed = coalesce((event_data->>'confirmed')::boolean, false),
  visible = coalesce((event_data->>'visible')::boolean, false);
insert into public.event_diagrams (event_id, position, diagram_data)
select e.id, diagram.ordinality::integer, diagram.value
from public.events e
cross join lateral jsonb_array_elements(coalesce(nullif(e.event_data->'diagrams', 'null'::jsonb), '[]'::jsonb))
  with ordinality as diagram(value, ordinality);
alter table public.events drop column event_data;
${functions}
commit;
`);
