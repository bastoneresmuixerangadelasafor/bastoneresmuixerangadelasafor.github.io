import { readFile } from "node:fs/promises";

const schema = await readFile(new URL("../supabase/migrations/202611070001_initial_schema.sql", import.meta.url), "utf8");
const typeStart = schema.indexOf("create type public.position_status ");
const typeEnd = schema.indexOf("create table public.event_attendance ");
const importStart = schema.indexOf("create function public.import_legacy_data(");
const importEnd = schema.indexOf("create function public.save_event(");
const saveStart = schema.indexOf("create function public.save_member_position(");
if ([typeStart, typeEnd, importStart, importEnd, saveStart].some(index => index < 0)) throw new Error("Could not find position schema");
const typeDefinition = schema.slice(typeStart, typeEnd);
const importFunction = schema.slice(importStart, importEnd)
  .replace("create function public.import_legacy_data(", "create or replace function public.import_legacy_data(");
const saveFunction = schema.slice(saveStart)
  .replace("create function public.save_member_position(", "create or replace function public.save_member_position(");

process.stdout.write(`
begin;
lock table public.member_positions in share row exclusive mode;
${typeDefinition}
alter table public.member_positions add column status public.position_status;
update public.member_positions set status = public.legacy_position_status(value);
alter table public.member_positions drop column value;
${importFunction}
${saveFunction}
commit;
`);
