# Supabase migration

The browser continues to use the existing `API` methods. Set `API_BACKEND=supabase` to route those actions to the `api` Edge Function; `API_BACKEND=gas` retains the current Google Apps Script implementation.

The production configuration currently builds `index.html` with GAS. The separately configured `new.html` preview uses Supabase and a separate session token and API cache. The two pages still share an origin and service-worker scope, so this is not isolated staging. For Supabase email links to return to the preview, configure `WEBSITE_URL` and the Supabase Auth redirect allowlist for the preview URL; this setting also controls notification links.

## Provision Supabase

1. Create a Supabase project.
2. For a new, empty project, run [`migrations/202611070001_initial_schema.sql`](./migrations/202611070001_initial_schema.sql) in the Supabase SQL Editor. Do not run this fresh schema over an existing installation; follow the existing-database upgrade procedure below instead.
3. Configure and deploy the Edge Function:

   ```powershell
   supabase secrets set WEBSITE_URL=<site-url>
   supabase functions deploy api
   ```

4. To retain push notifications, also set `FIREBASE_PROJECT_ID` and `FCM_SERVICE_ACCOUNT_JSON` as function secrets. For Google Forms response checks, also set `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON` and share response spreadsheets with that service account. Service-account JSON is secret and must never be added to this repository.
5. Add the site URL to Supabase Auth's redirect URL allowlist and configure SMTP for email links. Add `API_BACKEND=supabase`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_FUNCTION_NAME=api` to the appropriate `.config/development.env` or `.config/production.env`; run the matching `npm run setup_*` and build command. The service-role key belongs only in the migration process, never in the browser config.

The Edge Function deliberately disables gateway JWT verification so password and access-link actions can run without an existing session. It validates Supabase access tokens itself for all protected actions.

## Existing database upgrade

Back up the existing database and test this procedure on an isolated project before upgrading. The old database stores attendance and position relationships by name. The new schema uses UUIDs for events, trainings and dances, member IDs for members, and foreign keys for attendance, positions and push tokens. Legacy event and training identifiers are retained only for old links; member and dance names are resolved at the API boundary.

Event properties are stored in columns on `events`. Ordered diagrams are stored separately in `event_diagrams`, with each diagram retained as JSON to preserve its nested position, group and backup data. Diagrams still contain dance and member display names, so renaming a member or dance does not update historical assignments.
Member name, type, roles and active status are stored in columns on `members`; roles use a PostgreSQL text array. Member relationships remain in `member_relations`.
Training descriptions are stored in `trainings.description`; attendance and notes remain in `training_attendance`.
Member dance positions use one row per position in `member_positions`; `member_dances` preserves member/dance pairs even when they have no positions. Position orders are non-negative integers.
Attendance uses nullable `attending` booleans: true means attending, false means declined, and null means unanswered, including note-only entries. Position status uses the PostgreSQL enum `known`, `learning`, and `not_known`, with null for an unset value. The API translates the GAS values `SI`, `EN PROGRES`, and `NO` at the boundary.

Run `npm run test_relational` to exercise the fresh import, upgrade rollback, foreign keys and stable event/training IDs in an isolated PostgreSQL-compatible database.

Generate a single transactional SQL script from the repository root:

```powershell
node scripts\build-relational-upgrade.mjs | Out-File -Encoding utf8 -FilePath upgrade-relational.sql
```

Run the generated SQL in the SQL Editor for the intended project. It locks the legacy tables, checks that references are resolvable, copies existing rows, recreates the app tables, imports the snapshot and verifies record counts before committing. An error rolls back the transaction. Existing Auth users and audio objects are not deleted. The script replaces app tables and requires a maintenance window: do not run it while the old Edge Function or importer is serving writes.

Deploy the updated `api` Edge Function and frontend immediately after the schema upgrade, then test sign-in, attendance, event and training edits, positions, audio and push tokens before resuming use. The old Edge Function is incompatible with the new tables. Do not deploy the new function against the old schema. Keep the SQL script and any database backups private.

## Upgrade an existing relational schema

If an earlier relational schema has already been applied, back up the database and test upgrades on an isolated project first. Run the required upgrades below during one maintenance window, then deploy the updated `api` Edge Function before resuming writes. Do not run imports or allow writes between upgrades. The old function is incompatible with the upgraded schema. A fresh installation using the current initial schema does not need these upgrades.

If attendance tables still have a text `status` column, generate and run this SQL:

```powershell
node scripts\build-attendance-boolean-upgrade.mjs | Out-File -Encoding utf8 -FilePath upgrade-attendance-boolean.sql
```

If `member_positions` still has a `position_data` column, generate and run this SQL:

```powershell
node scripts\build-position-rows-upgrade.mjs | Out-File -Encoding utf8 -FilePath upgrade-position-rows.sql
```

It preserves member/dance pairs, including empty objects, and retains position statuses and timestamps. It rejects non-object data, non-string or unrecognized values, and non-canonical or out-of-range position keys. The API reconstructs the existing response format.

Otherwise, if positions are already rows but still have a text `value` column, run this instead:

```powershell
node scripts\build-position-enum-upgrade.mjs | Out-File -Encoding utf8 -FilePath upgrade-position-enum.sql
```

Blank position strings become null; `SI`, `EN PROGRES`, and `NO` become enum values. Other values stop the transaction rather than being discarded. Do not run both position upgrades.

If `trainings` still has a `training_data` column, generate and run this SQL next:

```powershell
node scripts\build-training-columns-upgrade.mjs | Out-File -Encoding utf8 -FilePath upgrade-training-columns.sql
```

It preserves training IDs, attendance and descriptions. It aborts if the JSON contains unsupported fields or non-text descriptions.

If `members` still has a `member_data` column, generate and run this SQL next:

```powershell
node scripts\build-member-columns-upgrade.mjs | Out-File -Encoding utf8 -FilePath upgrade-member-columns.sql
```

It preserves member IDs and relations, and rejects unsupported or inconsistent member data rather than silently discarding it.

If `events` still has an `event_data` column, generate and run this SQL after the member upgrade:

```powershell
node scripts\build-event-columns-upgrade.mjs | Out-File -Encoding utf8 -FilePath upgrade-event-columns.sql
```

Run each generated SQL script in the intended project's SQL Editor. The event upgrade retains event IDs, attendance, Auth and Storage, moves known event fields to columns, and moves diagrams to a separate table. Each transaction rejects unsupported JSON fields rather than silently discarding them; investigate any reported fields before retrying.

## Import current GAS data

Deploy the updated GAS server first so its admin-only `migrationExport` action is available. Use a valid GAS administrator session token and the same Supabase project created above:

```powershell
$env:LEGACY_API_URL="<current-GAS-exec-URL>"
$env:LEGACY_TOKEN="<GAS-admin-session-token>"
$env:SUPABASE_URL="<project-url>"
$env:SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
npm run migrate_supabase
```

Append `-- --create-auth-users` to the npm command to provision passwordless accounts for members who do not already have a Supabase Auth account.

The importer uploads every dance audio file from Google Drive to the private `dance-audio` bucket, then replaces the destination app tables in one transaction. Re-run it only when replacing the Supabase app data with a fresh full snapshot. If an audio upload fails, the database import does not run; retry the command. Add `--create-auth-users` to create passwordless Supabase Auth accounts for members with email addresses. Existing GAS password hashes are intentionally not copied because they are unsalted SHA-256 values and cannot be imported as Supabase credentials; users should sign in using the configured Supabase email link flow.

If an audio export fails, check the reported file in Google Drive and confirm the account running the GAS deployment can access it. If a valid copy is already in Supabase Storage and it is acceptable to use it even if it is older than Drive, retry with `npm run migrate_supabase -- --reuse-existing-audio --create-auth-users`. This option only reuses an existing nonempty object when its Drive export fails; the script warns which file was reused. It still stops before importing the database if the object is missing or unreadable.

To skip all audio downloads and uploads while still importing the database and optionally creating accounts, run:

```powershell
npm run migrate_supabase -- --skip-audio --create-auth-users
```

Omit `--create-auth-users` if accounts are not needed. `--skip-audio` leaves existing Storage objects unchanged and takes precedence over `--reuse-existing-audio`; audio missing from Storage will remain unavailable.

The export includes members and their relations, event details and diagrams, training descriptions, attendance and notes, member dance positions, data versions, and push tokens. Registration requests made before the cutover are not stored in GAS and cannot be exported. Google Forms attendance checks still read the source spreadsheet, so its service account must retain reader access to each response spreadsheet.

## Switch back

Set `API_BACKEND=gas`, rebuild, and redeploy the site. No frontend or GAS API methods need to change.
