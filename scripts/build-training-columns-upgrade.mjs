import { readFile } from "node:fs/promises";

const schema = await readFile(new URL("../supabase/migrations/202611070001_initial_schema.sql", import.meta.url), "utf8");
const start = schema.indexOf("create function public.import_legacy_data(");
const end = schema.indexOf("create function public.save_event(");
if (start < 0 || end < 0) throw new Error("Could not find import function in the schema");
const importFunction = schema.slice(start, end)
  .replace("create function public.import_legacy_data(", "create or replace function public.import_legacy_data(");

process.stdout.write(`
begin;
lock table public.trainings in share row exclusive mode;
do $$
declare invalid_id uuid;
begin
  select id into invalid_id from public.trainings
  where jsonb_typeof(training_data) is distinct from 'object'
    or training_data - 'description' <> '{}'::jsonb
    or (training_data ? 'description' and jsonb_typeof(training_data->'description') not in ('string', 'null'))
  limit 1;
  if found then
    raise exception 'Training % has unsupported data; no changes were made', invalid_id;
  end if;
end;
$$;
alter table public.trainings add column description text not null default '';
update public.trainings set description = coalesce(training_data->>'description', '');
alter table public.trainings drop column training_data;
${importFunction}
commit;
`);
