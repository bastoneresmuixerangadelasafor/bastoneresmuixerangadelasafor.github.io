import { readFile } from "node:fs/promises";

const schema = await readFile(new URL("../supabase/migrations/202611070001_initial_schema.sql", import.meta.url), "utf8");
const start = schema.indexOf("create function public.import_legacy_data(");
const end = schema.indexOf("create function public.save_event(");
if (start < 0 || end < 0) throw new Error("Could not find import function");
const importFunction = schema.slice(start, end)
  .replace("create function public.import_legacy_data(", "create or replace function public.import_legacy_data(");

process.stdout.write(`
begin;
lock table public.event_attendance, public.training_attendance in share row exclusive mode;
do $$
begin
  if exists (select 1 from public.event_attendance where status is not null and status not in ('SI', 'NO'))
    or exists (select 1 from public.training_attendance where status is not null and status not in ('SI', 'NO')) then
    raise exception 'Unsupported attendance status; no changes were made';
  end if;
end;
$$;
alter table public.event_attendance add column attending boolean;
alter table public.training_attendance add column attending boolean;
update public.event_attendance set attending = case status when 'SI' then true when 'NO' then false else null end;
update public.training_attendance set attending = case status when 'SI' then true when 'NO' then false else null end;
alter table public.event_attendance drop column status;
alter table public.training_attendance drop column status;
${importFunction}
commit;
`);
