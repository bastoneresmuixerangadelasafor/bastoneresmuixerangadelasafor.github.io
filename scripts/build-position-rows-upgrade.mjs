import { readFile } from "node:fs/promises";

const schema = await readFile(new URL("../supabase/migrations/202611070001_initial_schema.sql", import.meta.url), "utf8");
const importStart = schema.indexOf("create function public.import_legacy_data(");
const importEnd = schema.indexOf("create function public.save_event(");
const saveStart = schema.indexOf("create function public.save_member_position(");
const typeStart = schema.indexOf("create type public.position_status ");
const typeEnd = schema.indexOf("create table public.event_attendance ");
if (importStart < 0 || importEnd < 0 || saveStart < 0 || typeStart < 0 || typeEnd < 0) throw new Error("Could not find position migration functions in the schema");
const positionType = schema.slice(typeStart, typeEnd);
const importFunction = schema.slice(importStart, importEnd)
  .replace("create function public.import_legacy_data(", "create or replace function public.import_legacy_data(");
const saveFunction = schema.slice(saveStart)
  .replace("create function public.save_member_position(", "create or replace function public.save_member_position(");

process.stdout.write(`
begin;
lock table public.member_positions in share row exclusive mode;
do $$
begin
  if exists (select 1 from public.member_positions where jsonb_typeof(position_data) is distinct from 'object') then
    raise exception 'Position data must be an object; no changes were made';
  end if;
  if exists (
    select 1 from public.member_positions p cross join lateral jsonb_each(p.position_data) position
    where not (case when position.key ~ '^(0|[1-9][0-9]{0,9})$'
      then position.key::numeric <= 2147483647 else false end)
      or jsonb_typeof(position.value) <> 'string'
  ) then
    raise exception 'Unsupported position key or value; no changes were made';
  end if;
end;
$$;
alter table public.member_positions rename to member_positions_legacy;
alter table public.member_positions_legacy rename constraint member_positions_pkey to member_positions_legacy_pkey;
${positionType}
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
alter table public.member_dances enable row level security;
alter table public.member_positions enable row level security;
revoke all on public.member_dances, public.member_positions from anon, authenticated;
grant all on public.member_dances, public.member_positions to service_role;
insert into public.member_dances (member_id, dance_id, updated_at)
  select member_id, dance_id, updated_at from public.member_positions_legacy;
insert into public.member_positions (member_id, dance_id, position_order, status, updated_at)
  select p.member_id, p.dance_id, position.key::integer, public.legacy_position_status(position.value #>> '{}'), p.updated_at
  from public.member_positions_legacy p cross join lateral jsonb_each(p.position_data) position;
drop table public.member_positions_legacy;
${importFunction}
${saveFunction}
commit;
`);
