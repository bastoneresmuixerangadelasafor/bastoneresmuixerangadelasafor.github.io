import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const mock = `
const failed = "1XIhGj3cylFK2velpOdpWX4bW8FHx9RaT";
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(input);
  if (url.searchParams.get("action") === "migrationExport") {
    const members = process.env.MOCK_AUTH === "yes" ? [{ id: "1", alias: "Alice", email: "alice@example.invalid" }] : [];
    return Response.json({ success: true, result: { members, events: [], trainings: [], memberPositions: {} } });
  }
  if (url.searchParams.get("action") === "audio") {
    if (process.env.MOCK_NO_AUDIO === "yes") throw new Error("Audio must not be requested");
    if (url.searchParams.get("audioId") === failed) {
      return Response.json({ success: false, error: "Drive access denied" });
    }
    return Response.json({ success: true, result: { audioData: "data:audio/mpeg;base64,YQ==" } });
  }
  if (url.pathname.includes("/object/authenticated/")) {
    if (process.env.MOCK_NO_AUDIO === "yes") throw new Error("Storage must not be requested");
    return process.env.MOCK_EXISTING === "missing"
      ? new Response("", { status: 404 })
      : new Response(process.env.MOCK_EXISTING === "empty" ? "" : "audio");
  }
  if (url.pathname.includes("/object/")) {
    if (process.env.MOCK_NO_AUDIO === "yes") throw new Error("Storage must not be requested");
    return new Response("");
  }
  if (url.pathname.endsWith("/rpc/import_legacy_data")) {
    console.log("MOCK_DATABASE_IMPORT");
    return Response.json({ members: 0 });
  }
  if (url.pathname === "/auth/v1/admin/users") {
    if (options.method === "POST") {
      console.log("MOCK_AUTH_CREATED");
      return Response.json({});
    }
    return Response.json({ users: [] });
  }
  throw new Error("Unexpected request");
};
`;
const importUrl = `data:text/javascript;base64,${Buffer.from(mock).toString("base64")}`;

function run(args = [], existing = "present", extraEnv = {}) {
  return spawnSync(process.execPath, ["--import", importUrl, "scripts/migrate-to-supabase.mjs", ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      LEGACY_API_URL: "https://legacy.example.invalid",
      LEGACY_TOKEN: "test-token",
      SUPABASE_URL: "https://supabase.example.invalid",
      SUPABASE_SERVICE_ROLE_KEY: "test-key",
      MOCK_EXISTING: existing,
      ...extraEnv,
    },
  });
}

test("skip audio avoids all audio and Storage requests while importing and creating accounts", () => {
  const result = run(["--skip-audio", "--reuse-existing-audio", "--create-auth-users"], "missing", {
    MOCK_NO_AUDIO: "yes",
    MOCK_AUTH: "yes",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Skipping audio migration/);
  assert.match(result.stdout, /MOCK_DATABASE_IMPORT/);
  assert.match(result.stdout, /MOCK_AUTH_CREATED/);
  assert.doesNotMatch(result.stdout, /Migrated audio/);
  assert.doesNotMatch(result.stderr, /Reusing existing Supabase audio/);
});

test("audio export failures show the source error and stop before database import", () => {
  const result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Joan del riu - Per assajar/);
  assert.match(result.stderr, /Drive access denied/);
  assert.doesNotMatch(result.stdout, /MOCK_DATABASE_IMPORT/);
});

test("existing audio is reused only when explicitly requested", () => {
  const result = run(["--reuse-existing-audio"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Reusing existing Supabase audio/);
  assert.match(result.stderr, /may not match/);
  assert.match(result.stdout, /MOCK_DATABASE_IMPORT/);
});

test("missing or empty existing audio prevents database import", () => {
  for (const existing of ["missing", "empty"]) {
    const result = run(["--reuse-existing-audio"], existing);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Existing Supabase audio/);
    assert.doesNotMatch(result.stdout, /MOCK_DATABASE_IMPORT/);
  }
});
