import { readFile } from "node:fs/promises";

const schema = await readFile(new URL("../supabase/migrations/202611070001_initial_schema.sql", import.meta.url), "utf8");
const importStart = schema.indexOf("create function public.import_legacy_data(");
const importEnd = schema.indexOf("create function public.save_event(");
const memberStart = schema.indexOf("create function public.save_member(");
const memberEnd = schema.indexOf("create function public.save_member_position(");
if (importStart < 0 || importEnd < 0 || memberStart < 0 || memberEnd < 0) throw new Error("Could not find member migration functions in the schema");
const importFunction = schema.slice(importStart, importEnd)
  .replace("create function public.import_legacy_data(", "create or replace function public.import_legacy_data(");
const memberFunction = schema.slice(memberStart, memberEnd)
  .replace("create function public.save_member(", "create or replace function public.save_member(");

process.stdout.write(`
begin;
lock table public.members in share row exclusive mode;
do $$
declare invalid record;
begin
  select id, member_data - array['id', 'email', 'alias', 'name', 'type', 'roles', 'active'] as extra
    into invalid
  from public.members
  where jsonb_typeof(member_data) is distinct from 'object'
    or member_data - array['id', 'email', 'alias', 'name', 'type', 'roles', 'active'] <> '{}'::jsonb
    or (member_data ? 'id' and member_data->>'id' is distinct from id)
    or (member_data ? 'alias' and member_data->>'alias' is distinct from alias)
    or (member_data ? 'email' and nullif(member_data->>'email', '') is distinct from email)
  limit 1;
  if found then
    raise exception 'Member % has unsupported or inconsistent data: %', invalid.id, invalid.extra;
  end if;
end;
$$;
alter table public.members
  add column name text not null default '',
  add column type text not null default '',
  add column roles text[] not null default '{}',
  add column active boolean not null default true;
update public.members set
  name = coalesce(member_data->>'name', ''),
  type = coalesce(member_data->>'type', ''),
  roles = array(select jsonb_array_elements_text(coalesce(nullif(member_data->'roles', 'null'::jsonb), '[]'::jsonb))),
  active = coalesce((member_data->>'active')::boolean, true);
alter table public.members drop column member_data;
${importFunction}
${memberFunction}
commit;
`);
